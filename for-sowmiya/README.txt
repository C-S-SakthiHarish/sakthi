FOR SOWMIYA - FLOATING MEMORIES DRAFT


START
Open PowerShell in this folder and run:
  python server.py
Then open http://127.0.0.1:8080 in your browser.
Keep the terminal running. Ctrl+C stops it.

DRAFT FLOW
1. The first page is verification: choose Sowmiya or Sakthi and enter the three private answers.
2. Successful verification opens the second page with all memories and the letter.
2. Scroll through every photo and video, each with its own message.
3. Use Jump to a chapter to reach a related event.
4. Choose Open full size to inspect a memory.
5. Read the message directly below the memories, then choose a final response.
Edit the letter array in story.json to replace the message paragraphs.
Videos autoplay muted and loop, with native sound and playback controls.
Reduced-motion preferences disable automatic movement and playback.
Videos pause when the tab is hidden or a full-size viewer is open.
Both final responses work. The answer is neither sent nor stored.

UNLOCK ANSWERS
Your personal answers are stored in .local-security.json on the server.
This file is excluded from Git and cannot be downloaded through the website.
The sample-answer shortcut has been removed.

PERSONALISE
All 22 supplied files are linked directly from photos/; original files are unchanged.
Folders 1-6 each form one event album (2, 2, 2, 2, 3, and 3 items).
The eight loose files each have their own event, for 14 events and 22 individual cards.
Event order follows your supplied 14-item sequence; files within each folder retain their existing order.
The text, titles, captions, and hidden notes are draft placeholders.

Edit story.json: each asset now has its own title and message.
Change memories[].assets[].title and memories[].assets[].message for each card.
The parent memory title is the chapter heading; assets remain grouped by event.
Each memory has an assets list with src, kind (image or video), and alt text.
Use /photos/folder/file.jpg or /photos/folder/file.mp4 for existing files.
Reorder whole memory objects to change the event order.
Every asset is visible in its own card, with a full-size viewer.
Image width and height reserve layout space while photos load.
Videos support playback and seeking; photos are shown without cropping.
The photos/ and media/ routes both require the private unlock.
The photos/ folder is excluded from Git along with private settings.
Google Fonts needs an internet connection; fallback fonts are provided.
The welcome screen uses decorative hearts, with no public personal photos.

REAL ANSWERS
The server loads your saved answers from .local-security.json automatically.
To override them, set these environment variables in PowerShell before starting:
  $env:LOVE_DEMO = "0"
  $env:LOVE_MY_DOB = "YYYY-MM-DD"
  $env:LOVE_HER_DOB = "YYYY-MM-DD"
  $env:LOVE_FIRST_MOVIE = "Your real movie name"
  python server.py
Do not commit real answers to the source.
Movie matching ignores case and extra spaces.

PRIVACY
This is a local review draft, not a deployed website.
The server listens only on your own computer.
Story content and files in media/ require an authenticated session.
Sessions expire after 30 minutes; incorrect answers are limited to five per five minutes.
Demo mode is disabled when your local security settings are present.
Birthdays and a movie answer are guessable and do not prove someone's identity.
For a shared website restricted to just you and Sowmiya, use authenticated account
allowlists and HTTPS hosting. That deployment and identity setup are not included yet.
The Python development server is intended for local review, not internet hosting.

DESIGN
A rose-and-pearl background, clear rounded buttons, serif headings, and gently
floating media cards. Desktop cards are staggered in two columns; phones use
one column. Every photo and video has its own visible story. The book layout
and gallery pagination have been removed. Original media files are unchanged.
