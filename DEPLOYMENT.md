# TaxFlow CRM v3 — Ghid de Deployment Complet

## Arhitectura sistemului

```
Browser → Vercel (Next.js) → Supabase (PostgreSQL + Auth)
                           → Resend (Email SMTP)
```

## Cum funcționează autentificarea

1. **Admin** trimite invitație → Resend trimite email cu link unic (token 32 bytes)
2. **Utilizatorul** deschide link → completează nume + parolă → cont creat
3. **Login** → Supabase Auth emite JWT → stocat în cookie HttpOnly
4. **Middleware** verifică JWT la fiecare request → redirect dacă expirat/dezactivat
5. **RLS** în Supabase → admin vede tot, user vede doar datele proprii (la nivel DB)

---

## PASUL 1: Supabase — configurare

### 1.1 Crează proiect
1. Mergi la [supabase.com](https://supabase.com) → New Project
2. Nume: `taxflow-crm`
3. Parolă DB: generează una puternică și salveaz-o
4. Regiune: `eu-central-1` (Frankfurt — cel mai aproape de Moldova)

### 1.2 Rulează migrarea
1. În Supabase Dashboard → **SQL Editor**
2. Copiază conținutul fișierului `supabase/migrations/001_initial_schema.sql`
3. Paste → **Run** (F5)
4. Verifică: tabele create în **Table Editor**

### 1.3 Obține cheile API
**Settings → API:**
- `URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` (secret!) → `SUPABASE_SERVICE_ROLE_KEY`

### 1.4 Configurează Auth
**Authentication → Settings:**
- Site URL: `https://crm.taxflow.md` (domeniul tău)
- Redirect URLs: `https://crm.taxflow.md/**`
- Email confirmations: **OFF** (confirmăm prin invitație)
- Minimum password length: **8**

---

## PASUL 2: Resend — configurare email

1. Mergi la [resend.com](https://resend.com) → Sign up
2. **Add Domain** → adaugă `taxflow.md`
3. Adaugă DNS records la registrar (MX, DKIM, SPF)
4. Verifică domeniul (5-30 minute)
5. **API Keys** → Create Key → copiază `re_...`

> **Alternativă rapidă pentru test:** Folosește `onboarding@resend.dev` ca FROM
> (funcționează fără domeniu verificat, doar pentru emailuri proprii)

---

## PASUL 3: Vercel — deployment

### 3.1 Pregătește codul
```bash
# Inițializează git
cd taxflow-crm
git init
git add .
git commit -m "feat: TaxFlow CRM v3 cu auth"

# Creează repo pe GitHub și push
git remote add origin https://github.com/TU/taxflow-crm.git
git push -u origin main
```

### 3.2 Deploy pe Vercel
1. [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Framework: **Next.js** (detectat automat)

### 3.3 Variabile de mediu în Vercel
**Settings → Environment Variables**, adaugă:

| Variabilă | Valoare |
|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role — SECRET) |
| `RESEND_API_KEY` | `re_...` |
| `RESEND_FROM_EMAIL` | `noreply@taxflow.md` |
| `NEXT_PUBLIC_APP_URL` | `https://crm.taxflow.md` |

4. **Deploy** → așteptați ~2 minute

---

## PASUL 4: Creează primul cont Admin

Primul admin se creează **manual** prin Supabase:

### Opțiunea A — SQL direct
```sql
-- Rulează în Supabase SQL Editor DUPĂ ce ai creat contul prin Supabase Auth

-- 1. Mai întâi creează user în Authentication → Users → Add User
--    (email: ion@taxflow.md, parolă, confirm email: DA)

-- 2. Apoi execută:
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'ion@taxflow.md';
```

### Opțiunea B — Script de seed (recomandat)
```sql
-- Rulează după migrare, înlocuiește UUID cu cel din auth.users
INSERT INTO public.profiles (id, email, full_name, role, avatar_color)
VALUES (
  'uuid-din-auth-users',
  'ion@taxflow.md',
  'Ion Popescu',
  'admin',
  '#004437'
)
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

---

## PASUL 5: Domeniu custom (opțional)

### În Vercel:
**Settings → Domains** → Add Domain → `crm.taxflow.md`

### DNS la registrar (ex: Namecheap, GoDaddy):
```
Type: CNAME
Name: crm
Value: cname.vercel-dns.com
```

---

## Flux complet: Adăugare utilizator nou

```
Admin → /admin/users → "Invită utilizator"
  → Completează email + rol (User/Admin)
  → Click "Trimite invitația"
  → [Supabase] Token unic generat (32 bytes hex)
  → [Resend] Email trimis cu link:
     https://crm.taxflow.md/auth/invite/TOKEN
  → Utilizatorul deschide link-ul (valabil 7 zile)
  → Completează Nume + Parolă
  → [API] Cont creat în Supabase Auth
  → Token marcat ca acceptat
  → Redirect la Login
  → Utilizatorul se autentifică
  → Vede interfața conform rolului
```

---

## Securitate — ce e implementat

| Feature | Implementare |
|---------|-------------|
| Parole | Supabase Auth (bcrypt automat) |
| Sesiuni | JWT în cookie HttpOnly, expiră în 7 zile |
| RLS | Politici PostgreSQL — user nu poate vedea datele altora |
| Cont dezactivat | Sesiunile revocate imediat prin `auth.admin.signOut()` |
| Token invitație | 32 bytes random, exp. 7 zile, single-use |
| Rate limiting | Supabase Auth built-in |
| HTTPS | Vercel SSL automat |
| Service Role | Niciodată expus clientului, doar server-side |

---

## Structura proiect

```
taxflow-crm/
├── app/
│   ├── auth/
│   │   ├── login/page.tsx          # Pagina de login
│   │   └── invite/[token]/page.tsx # Înregistrare din invitație
│   ├── (app)/
│   │   ├── layout.tsx              # Layout cu sidebar (Server Component)
│   │   ├── dashboard/page.tsx      # Dashboard role-aware
│   │   └── admin/
│   │       └── users/              # Panou admin utilizatori
│   ├── api/
│   │   ├── auth/accept-invite/     # POST: creare cont din invitație
│   │   └── admin/
│   │       ├── invite/             # POST: trimite invitație
│   │       └── users/[id]/toggle/  # POST: activare/dezactivare
│   ├── layout.tsx
│   ├── globals.css
│   └── page.tsx                    # Redirect → /dashboard
├── components/
│   └── layout/
│       └── Sidebar.tsx             # Sidebar role-aware
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser client
│   │   ├── server.ts               # Server + Admin client
│   │   └── types.ts                # TypeScript types
│   └── email.ts                    # Resend templates
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Schema + RLS complet
├── middleware.ts                   # Protecție rute + verificare rol
├── .env.example                    # Template variabile de mediu
└── vercel.json
```

---

## Comenzi utile development local

```bash
# Instalare dependențe
npm install

# Copiază și completează variabilele
cp .env.example .env.local

# Start development
npm run dev

# Build producție
npm run build
```

---

## Troubleshooting comun

**„User not found" după login**
→ Profilul nu s-a creat automat. Verifică trigger-ul `on_auth_user_created` în Supabase.

**Email invitație nu ajunge**
→ Verifică Resend Dashboard → Logs. Asigură-te că domeniul e verificat sau folosești `onboarding@resend.dev` pentru test.

**„Access denied" pe /admin/users**
→ Verifică că profilul are `role = 'admin'` în tabela `profiles`.

**Utilizator dezactivat poate accesa**
→ Verifică middleware.ts și că politicile RLS sunt active pe tabela `profiles`.
