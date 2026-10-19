# VEWAI Website — Local Development Cheatsheet

This cheatsheet contains all the terminal commands to run, edit, and share the VEWAI website locally on your Mac. You can use these commands in your Mac Terminal, in Codex, VS Code, or Cursor.

---

## 1. Project Location & Terminal Navigation

Open the **Terminal** app on your Mac and navigate into the project directory:

```bash
cd "/Users/svzmd4/Library/Mobile Documents/com~apple~CloudDocs/AI/Website"
```

Verify you are on the right private branch:
```bash
git branch
```
*(It should show `* feature/public-landing-page`)*

If you ever need to switch back to this branch:
```bash
git checkout feature/public-landing-page
```

---

## 2. Start the Website (Local Server)

Run this command in your terminal to start the website:

```bash
npx next dev --webpack
```

* **Where to view it:** Open your browser and go to:
  👉 **`http://localhost:3000`**
* **To stop the server:** Press `Ctrl + C` in the terminal.

---

## 3. Share a Remote Link (Cloudflare Tunnel)

To let someone anywhere in the world view your website privately without publishing:

Open a **second terminal tab** (press `Cmd + T` in Terminal) and run:

```bash
cd "/Users/svzmd4/Library/Mobile Documents/com~apple~CloudDocs/AI/Website"
./tmp/cloudflared tunnel --url http://localhost:3000
```

Look for the line in the terminal output that looks like:
```text
https://<random-words>.trycloudflare.com
```
Copy and send that link. Anyone can open it on their phone, tablet, or laptop.

* **To stop sharing:** Press `Ctrl + C` in that terminal tab.

---

## 4. Key Files to Edit

Any changes you save in these files will **instantly refresh** in your browser at `http://localhost:3000`:

| File | What it controls |
| :--- | :--- |
| `app/page.tsx` | **The new public landing page** (Hero headline, Problem citation, Solution, Educator analytics, Team section, Ethos, Contact form). |
| `app/(auth)/login/page.tsx` | The login / simulator sign-in screen. |
| `public/images/logo-v.png` | The metallic 3D green "V" logo. |
| `public/images/demo-loop.mp4` | The video demo loop in the interactive preview card. |
| `.env.local` | Supabase configuration and public keys. |

---

## 5. Working with Codex & Antigravity Together

* **Same local files:** Everything is saved directly in your iCloud/Mac folder. Edits made in Codex or any code editor are immediately seen here, and vice versa.
* **Saving your progress in Git:**
  ```bash
  git add .
  git commit -m "your description of changes"
  ```
