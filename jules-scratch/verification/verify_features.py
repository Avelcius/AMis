from playwright.sync_api import sync_playwright, Page, expect
import time

def add_song_to_queue(page: Page, search_term: str):
    print(f"Searching for '{search_term}'...")
    search_input = page.get_by_placeholder("Поиск по названию или исполнителю...")
    search_input.fill(search_term)

    # Wait for search results to appear and click the first one
    first_result = page.locator(".search-result-item").first
    expect(first_result).to_be_visible(timeout=10000)
    first_result.click()

    # Wait for the confirmation/lyrics to show
    expect(page.locator("#lyrics-display")).not_to_be_hidden(timeout=10000)
    print(f"Added '{search_term}' to queue.")

def run_verification(page: Page):
    base_url = "http://localhost:3000"

    # --- 1. Add some songs to the queue first ---
    print("Navigating to controller to add songs...")
    page.goto(base_url)

    # Set nickname
    page.get_by_placeholder("Введите ваш никнейм").fill("Jules")
    page.get_by_role("button", name="Войти").click()
    expect(page.locator("#search-section")).not_to_be_hidden()

    # Add 6 songs to test the "show more" feature
    songs_to_add = ["God's Plan Drake", "Blinding Lights The Weeknd", "Shape of You Ed Sheeran", "Bohemian Rhapsody Queen", "Hotel California Eagles", "Stairway to Heaven Led Zeppelin"]
    for song in songs_to_add:
        add_song_to_queue(page, song)
        # Brief pause to allow next search
        time.sleep(0.5)

    # --- 2. Verify Admin Panel Redesign and Functionality ---
    print("\nNavigating to admin panel for verification...")
    page.goto(f"{base_url}/admin")

    print("Logging in...")
    page.get_by_placeholder("Пароль").fill("password")
    page.get_by_role("button", name="Войти").click()

    admin_view = page.locator("#admin-view")
    expect(admin_view).to_be_visible(timeout=5000)
    print("Login successful, admin view is visible.")

    # Let the queue populate
    expect(page.locator("#admin-queue-list .queue-item")).to_have_count(6, timeout=5000)
    print("Queue has been populated with 6 songs.")

    print("Taking screenshot of the redesigned admin panel...")
    page.screenshot(path="jules-scratch/verification/admin_panel_redesign.png")

    # Verify "Show More" button
    print("Verifying 'Show More' button...")
    show_more_btn = page.locator("#show-more-queue-btn")
    expect(show_more_btn).not_to_be_hidden()
    expect(show_more_btn).to_have_text("Показать все")
    show_more_btn.click()
    expect(page.locator("#admin-queue-wrapper")).to_have_class("expanded")
    expect(show_more_btn).to_have_text("Скрыть")
    page.screenshot(path="jules-scratch/verification/admin_queue_expanded.png")

    # Verify Drag and Drop
    print("Verifying drag-and-drop reordering...")
    first_item = page.locator(".queue-item").nth(0)
    third_item = page.locator(".queue-item").nth(2)

    initial_first_item_text = first_item.inner_text()

    # Drag the first item to the position of the third item
    first_item_handle = first_item.locator(".queue-handle")
    third_item_handle = third_item.locator(".queue-handle")

    first_item_handle.drag_to(third_item_handle)

    # Give a moment for the socket event to be processed
    time.sleep(1)

    # Verify the item has moved
    new_second_item = page.locator(".queue-item").nth(1)
    expect(new_second_item).to_have_text(initial_first_item_text)
    print("Drag and drop successful.")
    page.screenshot(path="jules-scratch/verification/admin_drag_drop.png")

    # Verify Delete with Confirmation
    print("Verifying delete with confirmation...")

    # Set up a dialog handler to automatically accept the confirmation
    page.once("dialog", lambda dialog: dialog.accept())

    # Click the delete button on the new first item
    page.locator(".queue-item").first.locator(".remove-btn").click()

    # The queue should now have 5 items
    expect(page.locator("#admin-queue-list .queue-item")).to_have_count(5, timeout=5000)
    print("Delete with confirmation successful.")
    page.screenshot(path="jules-scratch/verification/admin_delete.png")

    print("\nVerification script completed successfully!")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run_verification(page)
        finally:
            browser.close()

if __name__ == "__main__":
    main()
