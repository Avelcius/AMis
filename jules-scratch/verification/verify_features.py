from playwright.sync_api import sync_playwright, Page, expect
import time

def run_verification(page: Page):
    base_url = "http://localhost:3000"

    # --- 1. Verify Admin Panel Redesign ---
    print("Navigating to admin panel...")
    page.goto(f"{base_url}/admin")

    print("Logging in...")
    page.get_by_placeholder("Пароль").fill("password")
    page.get_by_role("button", name="Войти").click()

    print("Waiting for admin view to be visible...")
    admin_view = page.locator("#admin-view")
    expect(admin_view).to_be_visible(timeout=5000)

    print("Taking screenshot of the new admin panel...")
    page.screenshot(path="jules-scratch/verification/admin_panel.png")

    # --- 2. Verify Explicit Tag and Static Lyrics ---
    print("Navigating to controller page...")
    page.goto(base_url)

    print("Setting nickname...")
    page.get_by_placeholder("Введите ваш никнейм").fill("Jules")
    page.get_by_role("button", name="Войти").click()

    print("Searching for a song...")
    search_input = page.get_by_placeholder("Поиск по названию или исполнителю...")
    expect(search_input).to_be_visible()
    # Using a song very likely to be explicit and have lyrics
    search_input.fill("WAP cardi b")

    print("Waiting for search results...")
    # Wait for the explicit tag to appear
    explicit_tag = page.locator(".explicit-tag").first
    expect(explicit_tag).to_be_visible(timeout=10000)
    expect(explicit_tag).to_have_text("E")

    print("Taking screenshot of search results with explicit tag...")
    page.screenshot(path="jules-scratch/verification/explicit_tag.png")

    print("Adding song to queue...")
    page.locator(".search-result-item").first.click()

    print("Waiting for static lyrics to appear...")
    lyrics_display = page.locator("#lyrics-display")
    expect(lyrics_display).not_to_be_hidden(timeout=10000)
    lyrics_text = page.locator("#lyrics-text")
    # Wait for lyrics text to be non-empty
    expect(lyrics_text).not_to_be_empty(timeout=15000)

    print("Taking screenshot of static lyrics...")
    page.screenshot(path="jules-scratch/verification/static_lyrics.png")

    # --- 3. Verify Karaoke Lyrics on Display Page ---
    print("Navigating to display page...")
    page.goto(f"{base_url}/display")

    print("Waiting for karaoke lyrics to appear...")
    karaoke_container = page.locator("#karaoke-lyrics")
    # The song from the other page should be playing
    expect(karaoke_container).not_to_be_hidden(timeout=15000)

    # Wait for a few seconds to let some lyrics pass
    print("Waiting for karaoke to progress...")
    time.sleep(5)

    print("Taking screenshot of karaoke lyrics...")
    page.screenshot(path="jules-scratch/verification/karaoke_lyrics.png")

    print("Verification script completed successfully!")


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
