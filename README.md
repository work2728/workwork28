# PadiHire

Freelance marketplace for Nigeria. Runs entirely on Cloudflare:

- **Pages**: the website (`public/`)
- **Pages Functions**: the backend (`functions/api/[[path]].js`)
- **D1**: the database (`schema.sql`)

## Files

```
functions/api/[[path]].js   backend (all /api/... routes)
public/index.html           the app
public/app.js               app screens
public/common.js            shared helpers
public/app.css              styles
public/admin.html           admin panel, at /admin
public/admin.js
public/favicon.svg, _headers, robots.txt
schema.sql                  run once in the D1 console
```

## Setup (about 15 minutes, all from your phone)

1. **GitHub.** Create a new **private** repo called `workwork28`. Upload everything from this zip so `functions`, `public` and `schema.sql` sit at the top level of the repo, not inside another folder.
2. **Database.** In Cloudflare, go to **Storage & Databases → D1 → Create database** and name it `padihire`. Open it, tap **Console**, paste all of `schema.sql`, then tap **Execute**.
3. **Website.** Go to **Workers & Pages → Create → Pages → Import an existing Git repository** and pick `workwork28`. Use these settings:
   - Project name: `padihire` (your free address becomes padihire.pages.dev)
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `public`

   Tap **Save and Deploy**.
4. **Connect the database.** In the Pages project, go to **Settings → Bindings → Add → D1 database**. Set the variable name to `DB` (capital letters) and pick the `padihire` database. Save.
5. **File storage (CVs and attachments).** In Cloudflare, go to **R2 → Create bucket** and name it `padihire-files`. Then in the Pages project, go to **Settings → Bindings → Add → R2 bucket**. Set the variable name to `FILES` and pick `padihire-files`. Save.
6. **Make yourself admin.** Go to **Settings → Variables and Secrets → Add**. Set the name to `ADMIN_EMAILS` and the value to your email. To add more admins later, separate the emails with commas. Save.
7. **Redeploy.** Go to **Deployments**, open the latest one, then tap **⋯ → Retry deployment**. The binding and the variable only take effect after a new deploy.
8. **First login.** Open the site, then **Sign up** with the same email you put in `ADMIN_EMAILS`. Choosing "client" is fine. Then go to `padihire.pages.dev/admin` → **Settings**:
   - Enter your company bank name, account number and account name. Top-ups stay closed until these are filled in.
   - Enter your support WhatsApp number.
   - Fees (5% client, 10% freelancer), the monthly proposal limit (20) and auto-release (5 days) can all be changed here.

## Daily admin routine (at /admin)

- **Top-ups:** find the transfer in your bank app by its reference (for example `PH72UZ5U`). Tap **Confirm** and change the amount if they sent a different one. Their wallet is credited straight away.
- **Withdrawals:** send the money from your bank app first, then tap **Mark as paid**. If the bank details are wrong, use **Return to wallet**.
- **Disputes:** read the chat, then **Pay freelancer** or **Refund client**. When refunding, you choose whether the service fee is refunded too.
- **Overview → Money check:** shows how much should be in your bank account and whether the books balance.
- **Users:** suspend accounts, or **Reset password**. That gives you a temporary password to send the user on WhatsApp.
- **Flags:** phone numbers, emails, WhatsApp/Telegram mentions, social handles and "pay me outside" talk are replaced with **** for the other person. Each one is listed here with the original text, so you can warn or suspend repeat offenders.

## Updating an existing database

Each update ships with an `update-N.sql` file. Run it **once** in the D1 Console (same as `schema.sql`), then redeploy.
- `update-2.sql`: CV and attachments, contact flags.
- `update-3.sql`: email confirmation, password reset, email alerts, spam limits, portfolio.

## Email and spam protection (optional settings)

These switch on by adding variables in Cloudflare: Workers & Pages > workwork28 > Settings > Variables and Secrets (Production). Redeploy after adding them.

- `RESEND_API_KEY` (secret): from resend.com > API Keys, after your domain is verified there.
- `MAIL_FROM`: the sender, for example `PadiHire <hello@padihire.com>`. It must use the domain you verified in Resend.
- `SITE_URL`: your live address, for example `https://padihire.com`. Used for links inside emails.
- `TURNSTILE_SITEKEY` and `TURNSTILE_SECRET` (secret): from Cloudflare > Turnstile > Add widget, with your domain added.

Without the Resend variables, the site works as before: no emails, and "Forgot password" sends people to WhatsApp support. Without the Turnstile variables, sign-up has no human check. Login and sign-up limits work either way.

## How the money works

- A client posts a job for free.
- When they hire, they pay the freelancer's price plus the client fee (5%) from their wallet. The price is held in escrow and the fee is PadiHire's.
- When the client approves, the freelancer gets the price minus the freelancer fee (10%) in their wallet. If the client doesn't respond, this happens automatically 5 days after delivery.
- Each side only ever sees its own fee.
- Wallet balances can never go below zero, and no payment can be released or refunded twice.

## Not in this first version

- Email and SMS alerts. For now, users see unread badges in the app.
- Password reset by email. For now, use **Reset password** in admin and send the new password on WhatsApp.
- Automatic bank confirmation of top-ups. Can be added later with a virtual-account provider.
