# Nivisa — design decisions

Why the product looks and behaves the way it does. Tokens live in
`web/src/styles/globals.css`; this records the reasoning behind them and the
interaction decisions that are not obvious from the code.

---

## Visual direction

**Warm contemporary interiors.** An ivory ground, ink type, a rationed
terracotta accent, and materials named after what they are: limewash, clay,
verdigris, madder, ochre.

Three rules that shape everything:

1. **Primary is ink, not the accent.** Near-black buttons read as premium
   retail; a terracotta button on every card reads as a discount store. The
   accent earns attention because it is rationed to links, badges and rules.
2. **No blue-grey anywhere.** Every neutral comes from one warm ramp. A cool
   grey beside ivory reads as a rendering bug.
3. **Restrained radius.** Nothing above 10px. Furniture is rectilinear;
   pill-shaped everything is the tell of a template.

### Typography

**Fraunces** (variable — `opsz`, `SOFT`, `WONK`) for display, **Instrument
Sans** for all UI, prices, forms and tables.

The UI/UX skill proposed Playfair Display + Inter. Both were rejected:
Playfair has become the default "luxury" serif and no longer signals care, and
Inter is the single strongest visual marker of an AI-built site. Fraunces reads
hand-cut rather than corporate; Instrument Sans has a taller x-height, narrower
figures, and unambiguous 1/7/9 — which matters when the whole catalogue is
five-figure rupee amounts.

The skill also proposed **Liquid Glass** as the style. Rejected outright: the
brief bans glassmorphism, and the skill's own output flags it
"Performance: Moderate-Poor, Accessibility: text contrast."

### Contrast

Every token pair was measured, not estimated. All text pairs meet WCAG AA.

Two tokens exist purely because measurement caught a problem:

- `ink-subtle` (3.7:1) is documented large-text/icons only, never body copy.
- `border-interactive` (3.7:1) is separate from the decorative `border` /
  `border-strong` pair (1.2:1 / 1.5:1). Control outlines need 3:1 under
  WCAG 1.4.11; card dividers deliberately do not, because a hard line around
  every card fights the imagery. **Never substitute one for the other.**

---

## Spacing and reserved space

**One section rhythm, and every band uses the token.** `--space-section-sm`
(56) on mobile, `--space-section` (96) from `lg`. `HomeSection` owns it for
most bands, but the hero and the promo band build their own frame and had
hard-coded it — the promo band at `py-16`, which is 64 and put one band 8px out
of step with the nine around it on every phone. Both now read the token. The
value being right today is not the point: a literal that happens to match
cannot follow the token when it changes, and drift of this kind is what makes a
long page feel assembled rather than designed.

**Section rhythm answers to viewport height, not only width.** 96px above and
below is right on a tall display. On a 1536x700 laptop the pair costs 192px,
and under 202px of banner and header it pushed the hero's own buttons through
the fold — 26px of "Shop all furniture" sat below the screen on first paint,
so the first impression was a headline with no visible way to act on it. A
width breakpoint cannot see that, because the window is wide. Two height steps
at desktop widths: 72px under 900, 48px under 720.

Height *and* a desktop width, deliberately. A phone's viewport height changes
as the URL bar hides, so keying padding to it there would reflow the page
mid-scroll; mobile keeps the flat `--space-section-sm`. Steps rather than a
`clamp()`, so the rhythm stays a round number the spacing scale can land on.

**Under 864px of height the hero steps down a size rather than overflowing.**
Padding alone could not save it: the text column is 570px on its own, so the
three trust figures sat 127px below the fold and the illustration was clipped
by 101px. The compact hero drops from `--text-5xl` to `--text-4xl` — the hero's
own mobile size, not a new one — tightens its internal rhythm, and caps the
illustration instead of letting it set the section height. Mass is the first
thing to give up when the screen is short; the proposition is the last.

The threshold is 864 and not 720 because at the tightened rhythm the text
column still ends at 843px. 1366x768 and 1536x800 are two of the most common
laptop viewports there are, and both sit in that gap — a 720px threshold looks
fixed on the one screen it was tested against while the majority of real
laptops still cut the trust row.

**The hero illustration takes its height from the text column.** A fixed ratio
left it shorter than the copy at every desktop width, so the split read as
lopsided — and worse, a ratio-driven frame can grow taller than the text and
set the section height on its own, which is what pushed the hero past the fold.
Height now comes from the column carrying the proposition. The SVG is
absolutely positioned inside the frame: left in flow its 200x160 viewBox
reports a 5:4 height of its own, and `h-full` in a content-sized grid row falls
back to exactly that, which is how the frame kept setting the row height
instead of taking it. No layout shift either way — the height is settled by
text layout, before any image would have loaded.

**The two conversion buttons were below the fold as well.** The same audit at
1536x700 found "Add to cart" 58px under the screen and the cart's "Checkout"
50px under it — the two most important buttons in the store, invisible on
arrival, on the one page each where nothing else matters. Every other page
passed: listing, category, orders, about and the empty states all keep their
first action on screen.

Both were fixed the same way as the hero: a height-tiered page shell
(`--space-page`), and internal rhythm that closes up under 864px rather than
content being dropped. The buy panel's five blocks and the cart summary's
padding give up space; every price row, option and field stays.

**`--buy-stack-gap` is a variable because Tailwind's `space-y-*` outranks any
sensible override.** Its generated selector carries three levels of
specificity, so a scoped rule loses to it. The value has to be the thing that
changes, not the rule that sets it.

**Chrome that floats over the page is reserved for by token, not by eye.**
`--space-header` / `--space-header-lg` and `--space-bottom-nav` are each the
element's content box *plus its borders*, and the bottom navigation adds
`env(safe-area-inset-bottom)`. Rounding any of those away hides content by
exactly the amount you rounded.

**The header is two rows from `lg` up.** 80px utility row, 1px rule, 48px
navigation row, 1px bottom border — 130, not 80. Reserving only the first row
is the easy version of this bug and hides half the header's worth of whatever
you jumped to.

**Sticky panels park at `--space-sticky-top`, derived from the header.**
`top-28` (112px) was 18px short of the two-row desktop header, so the cart
summary and the product buy panel both docked *underneath* it and lost their
first line the moment they stuck.

**Anchor jumps clear the header via `scroll-margin-top` on `[id]`.** Without
it, an in-page link lands its target at y=0, underneath a sticky header:
`#reviews-heading` scrolled the word "Reviews" entirely out of sight, and the
skip link put `#main` behind the very chrome it exists to skip. The rule
targets `[id]` rather than `:target` because most jumps here come from
`scrollIntoView()`, which sets no hash and so never matches `:target`. The
extra 1rem is deliberate — a heading flush against the header still reads as
clipped.

**The bottom-navigation clearance wraps main *and* the footer.** It sat on
`main` alone, which protected nothing: the footer renders after main and is
what actually ends the page, so the last line of the footer sat 7px from the
bottom navigation on a desktop-sized viewport and underneath it on any phone
with a home indicator. The same measurement lives in one token now, shared with
the product page's sticky buy bar, because two hand-written copies of that
calc() drift the moment the nav changes height.

---

## Navigation

**Mega-menu triggers are disclosure buttons, not hover targets.** Hover alone
is not an interaction: unreachable by keyboard, non-existent on touch. Hover
opens for pointers, Enter opens for keyboards, Escape and focus-out close.

The panel carries its own "View everything in *section*" link, because the
trigger is a button and no longer navigates.

**Mega-menu group labels are paragraphs, not headings.** As `h3`s they injected
themselves into the document outline ahead of the page's own `h1`, so a screen
reader user browsing by heading met "Seating" before the page title. The lists
are named via `aria-labelledby` instead.

**The mobile drawer is portalled to `document.body`.** The header carries
`backdrop-blur`, and `backdrop-filter` makes an element a containing block for
`position: fixed` descendants — rendered in place, the drawer was sized against
the 64px header box rather than the viewport. The portal is the fix and cannot
be removed while the header keeps its blur.

**Mobile navigation is an accordion, not a drill-down.** Drill-downs look
tidier but cost a tap to discover what a section contains, and their back
gesture competes with browser back.

**Bottom navigation carries Cart.** It is the destination that matters most and
the one worst served by a 44px target in a top corner.

**Search is an inline combobox, not a modal.** On a furniture site search is a
refinement tool used mid-browse, not a destination. Debounced at 220ms; queries
under two characters are not sent, because the backend returns empty buckets
for them anyway.

---

## Product card

Two things sell furniture from a grid: a large image, and whether the piece
fits. So the frame takes most of the card, and **dimensions sit directly under
the name, above the rating** — "210 × 90 cm" answers a question that four and a
half stars cannot.

**One badge maximum**, by priority. A card wearing four badges communicates
nothing.

**No quick-add button.** Furniture is not an impulse purchase. A customer who
has not chosen a finish or checked delivery is not ready to add to cart, and a
card-level Add on a ₹43,000 sofa produces abandoned carts, not orders. The
card's job is to earn the click.

---

## Homepage

Sequenced as a funnel, not a list of rails:

> orient (hero) → choose an entry point (room, then category) → see product
> (bestsellers) → understand why here (trust) → see product again
> (new arrivals) → campaign → social proof → editorial

**Room comes before category.** Shoppers arrive with a room in mind ("something
for the balcony") far more often than a product type ("a bench").

**Two product rails, not five.** A homepage that is mostly product rails is a
catalogue with a banner on top, and it teaches customers that scrolling is how
you shop — which is what category pages are for.

**Trust signals sit after the first rail, not before.** They persuade someone
who has already found something they like; shown first they are just claims
about a company nobody yet has reason to care about.

**The hero is an asymmetric split, not text over a photograph.** Text over an
image is the most common contrast failure in retail — copy that passes on the
mockup fails on the photo that replaces it.

---

## Listing pages

**State lives in the URL, not React state.** A filtered grid gets shared,
bookmarked and back-buttoned. Component state breaks all three and makes the
page uncrawlable. Every control writes a URL; the server reads it and renders.

**Listing pages are server-rendered.** A category page that ships an empty div
and fetches on the client is invisible to search engines and a skeleton to
anyone on a slow connection. Products are in the HTML.

**Only filters the backend can honour are shown.** Material, finish, colour,
room, style, seating capacity and rating are all in `ProductFilters` and none
has an API behind it (API-GAPS §2, §4). They are not rendered greyed out — a
disabled filter is worse than an absent one: it advertises a capability,
occupies space a working control could use, and reads as broken. The same rule
removes the rating and discount sorts from the sort menu.

**Collections do not get a filter sidebar.** That endpoint accepts only `q`,
`limit` and `offset`, so the controls would quietly do nothing — and a
collection is a curated, ordered set, which re-sorting by price would destroy.

**Real pagination links, not "Load more".** Crawlable, back-button-correct, and
page 4 is reachable without loading 2 and 3. Canonicals include the page number
but drop filters: filter permutations are near-infinite near-duplicates, while
page 2 holds products that appear nowhere else — canonicalising it to page 1
would remove them from the index.

**Two columns on mobile, not one.** A single-column furniture grid looks
generous in a mockup and is bad in use: one product per screen means comparing
two sofas from memory. Four columns is the desktop maximum — a fifth drops each
image below the size where upholstery and joinery are legible.

**No `loading.tsx` on routes that can 404.** A `loading.tsx` creates a Suspense
boundary, so Next streams the shell — and flushes 200 headers — before
`notFound()` throws. `/category/nonexistent` then renders the 404 page with a
**200 OK** status, which search engines index as a real page. Measured on Next
16.3.3: with the file, 200; without it, 404. Correct status beats an instant
skeleton on a catalogue, so `/category/[slug]` and `/collection/[slug]` go
without; `/shop` and `/search` keep theirs because neither can 404.

**The empty state is chosen by cause.** Over-filtering offers widening, a search
miss offers rephrasing, an empty category points back at the catalogue. The
search term itself is not counted as a filter, or "search without filters"
would clear the query and land the customer on a blank page.

---

## Performance

**Rails are one list switched by CSS, not two trees.** Rendering a mobile rail
and a desktop grid separately is the obvious approach and the wrong one:
browsers still fetch images inside `display: none`, so every visitor would
download both sets. This halved the homepage DOM (20 cards → 12) and would
halve rail image payload once real photography lands.

**Every image frame reserves its aspect ratio**, so grids never reflow as
images arrive — the largest source of layout shift on an image-heavy store.

**Reduced motion is honoured globally**, in one media query, so a newly added
animation cannot forget to opt in.

---

## Product detail page

Ordered by the questions a furniture buyer actually asks, in order: what does
it look like → what does it cost → will it fit → what is it made of → will it
arrive intact → what did other people think.

**Sections, not tabs.** Tabs hide the answer to the question the customer came
with. On a furniture page the specification *is* the product.

**Every section renders conditionally.** Most of this data is absent on the
current backend (API-GAPS §2), so an unmigrated product shows a description and
a dimension line rather than eight headings with nothing under them. A page of
empty sections looks broken in a way a shorter page does not.

**A scale footprint diagram, not just three numbers.** Width and depth are
drawn to scale against each other, so the proportions are visible before a tape
measure comes out. The diagram never stretches to fill its box — that would
misrepresent the shape.

**Buy Now routes through the cart, not `/orders/direct`.** The direct-order
endpoint exists but bypasses cart-level coupon and shipping rules, so it would
quote a different price here than at checkout.

**The quantity cap accounts for what is already in the cart.** The backend
rejects an over-quantity add against the running total; a stepper that stops is
better than an error toast after the fact.

**Low stock states a real number** ("Only 3 left"), never "Hurry!". Scarcity
only persuades when it is checkable.

**The variant selector is hidden when there is one variant.** The adapter emits
a single implicit variant for every product, and a selector with one option is
a control that cannot be used.

**The pincode check never blocks.** The API returns city and state only — no
serviceability, no delivery estimate — so a miss says "we could not confirm
that automatically", never "we do not deliver there". The documented contract
is explicit that clients must not block on this lookup.

**`aggregateRating` is emitted only when reviews are real and visible.** Rating
markup above a page showing no reviews is both a lie to the reader and the
pattern that gets rich results revoked. Demo mode derives the rating from the
demo reviews it renders, so the card badge, the JSON-LD and the visible list
all read from one source.

**The mobile sticky bar observes the buy panel by id**, not a sentinel inside
itself — the component sits at the end of the page, so a local sentinel would
only leave the viewport at the footer, exactly when the bar is no longer
needed. It clears the bottom navigation with
`calc(3.5rem + 1px + env(safe-area-inset-bottom))`: a flat `bottom-14` overlaps
the nav by the safe-area amount, invisible in a desktop viewport and covering
the nav on a real iPhone.

---

## Account area

**Signed-out visitors get a prompt, not a redirect.** A redirect loses the page
they were trying to reach and, on a slow connection, flashes an empty account
area first. The prompt carries `?next=` so sign-in returns them exactly where
they were.

**Only delivery addresses are exposed.** The backend also has `billing` and
`other` tables, but orders ship to a delivery address and nothing customer-
facing reads the other two. Three parallel address books would be asking the
customer to model the database.

**An address used in an order cannot be edited, and the page says so.** Orders
reference the row by id, so editing it would rewrite the shipping address on
past orders; the backend returns 409. The UI never offers Edit on such a row —
discovering the block after filling in a form is the worst version of this.

**Removal is confirmed, not undoable.** There is no restore endpoint, so a
mis-tap would be unrecoverable.

**The phone number is read-only, not disabled.** A disabled field is skipped by
keyboard navigation and by some screen readers, so the number would be
invisible to exactly the people who most need it read aloud.

**One wishlist component behind two routes.** `/wishlist` (where the header
heart points) has no account chrome, so a guest meets a prompt about saved
pieces rather than the navigation for an account they do not have;
`/account/wishlist` renders the same list inside the account shell.

---

## Navigation must lead somewhere that works

Every href in `config/navigation.ts` is checked against the running app. Three
classes of dead link were found there and fixed:

- `/shop?c=sofas` and nineteen siblings returned an **empty grid** — "sofas" is
  not a category id, and the backend has no product-type taxonomy.
- `/shop?material=teak` returned the **entire unfiltered catalogue** — there is
  no material filter, and the listing correctly drops the parameter. A link
  that appears to narrow and does not is the exact failure the filter panel was
  designed to avoid.
- `/collection/small-space` and four siblings **404'd** — collections are eight
  fixed backend rails and cannot be invented.

Product types and materials now resolve to `/search?q=…` with singular head
nouns (a plural never substring-matches a product name). A search page is
honest about being a search and returns real matches. Rooms keep
`/category/<slug>`, which genuinely filters.

---

## Cart and checkout

**The backend owns every rupee.** The cart summary renders the server's
`subtotal`, `savings`, `shippingFee`, `ruleDiscount` and `total` verbatim.
Coupon and shipping rules live server-side and a second implementation would
eventually disagree with the amount actually charged. The one exception is the
demo cart, which has no server to be authoritative and says so on screen.

**Out-of-stock lines block checkout rather than being silently dropped.**
Quietly removing something the customer chose means they find out at the
confirmation, if at all.

**The coupon field is collapsed behind a link.** An open, empty promo box tells
people a discount exists that they do not have, and sends them off to search
for one — frequently never returning.

**Checkout is outside the storefront layout.** No mega-menu, no bottom
navigation, no footer sitemap: every link out of a nearly-complete order is an
opportunity to abandon it. The only navigation is back to the cart.

**Three steps, not five.** Who you are, where it goes, payment — which is what
the backend actually needs. A separate "review" step would be a page whose only
content is a summary already visible in the sidebar. Completed steps collapse
to a summary line with Edit, so nothing is hidden behind a back button.

**Address fields follow how an Indian address is recalled**: name and phone,
then pincode, then the city and state the pincode fills in, then street detail.
One lookup fills two fields the customer would otherwise type — and when it
misses, the fields stay editable and the form stays submittable. The API
contract is explicit that clients must never gate on that lookup.

**A failed submit announces itself in a summary, and focus moves there.**
Inline errors alone are a silent failure: focus stays on the submit button, so
a screen reader user is told nothing and someone at high zoom sees no change on
the part of the page they are looking at. The summary lists problems in *visual*
field order — not the order `validate` happens to check them — and each item is
a link to the field it belongs to, which on a phone is the difference between a
tap and a hunt.

**The summary is the only live region; inline errors are not.** They were
`role="alert"` each, so six invalid fields fired six announcements over each
other and over the summary. They are still reached programmatically through
each field's `aria-describedby`, which is read the moment focus arrives from a
summary link.

**The summary title is a paragraph, not a heading.** A heading would enter the
document outline only on failure, so the outline would change shape between
submits. `aria-labelledby` names the region without that cost — the same trade
the mega-menu group labels make.

**"Save for later" only appears when signed in.** The wishlist endpoint
requires auth, so for a guest it would remove the item and then fail to save it
anywhere.

**The payment return retries before reporting failure.** PhonePe returns with
no outcome in the URL, and the backend confirms payment on read. Telling
someone their payment failed while it is still settling is the worst possible
false negative — it produces a second payment for the same order.

**Nothing about order placement retries automatically.** A repeated "place
order" is a duplicate order, not a recovered one.

---

## Orders

**Cancellation is gated on PAYMENT state, not fulfilment state.** The backend
rejects with 409 when an order is already cancelled or already paid — once paid,
cancelling means arranging a refund and is staff-only. An earlier version of
`isCancellable` gated on `status` being pending/processing, which would have put
a Cancel button on every paid order and produced a 409 the moment it was
pressed.

**A paid order gets a phone number, not a dead button.** The customer still
needs to cancel; the honest answer is who to ask, with the order number to
quote.

**The destructive dialog focuses the safe option.** On a confirmation that
cannot be undone, a stray Enter should keep the order, not cancel it.

**Fulfilment and payment are always shown as separate facts** — they are
separate axes on the backend, and an order can be delivered and unpaid, or paid
and not yet dispatched.

---

## `useSearchParams` on a prerendered page

`/login` shipped broken and it is worth recording why. Reading
`useSearchParams()` in a statically prerendered page forces that subtree into a
client-rendered Suspense boundary. On this route the boundary never resolved:
the server sent the fallback, the content streamed into an `S:0` placeholder
outside `<main>`, and the subtree never hydrated. The symptom was subtle — the
phone field accepted typing (the DOM value changed) while the "Send code"
button stayed disabled, because React state never saw the input.

The fix is to read the parameter in a **server component** and pass it down as a
prop, which removes the boundary entirely. Prefer that wherever a page needs a
search parameter and does not otherwise have to be a client component.

Two related habits this reinforced:
- Test interactivity, not just presence. The markup was all there; only the
  behaviour was missing.
- `innerText` returns empty for non-rendered content, so use `textContent` when
  probing a page whose layout may be suspended.

---

## Back office

**A different register, not a second design system.** Same tokens; different
density and colour roles. A dark fixed rail, 14px base instead of 16, tight
vertical rhythm, no display serif. The storefront is selling a sofa; this is a
tool someone uses for six hours a day, and the two should not be mistaken for
each other at a glance.

**Sign-in renders in place, not on a separate route.** An admin whose 12-hour
token expires mid-task gets the form over the page they were on, and lands back
on it.

**The admin session is completely separate from the customer session** —
different token, different storage key. Signing out of one must not sign out of
the other.

**The login failure message is deliberately generic.** "Check your email and
password" rather than distinguishing an unknown account from a wrong password:
on an admin login, the specific version is a free staff-email enumeration
oracle.

### Catalogue management

**A dense table, not cards.** This screen exists for an operator scanning four
hundred products for the one that needs attention. Cards would halve the rows
on screen and cost the column alignment that makes prices scannable.

**Stock leads, not price.** People open this page because something ran out.
Low and out-of-stock rows carry a word as well as a colour, so the state
survives greyscale and colour-blindness.

**Bulk actions are show/hide only.** Delete cascades on the backend, and a
destructive operation wired to a multi-select is how a catalogue gets wiped by
a stray click. Bulk writes run sequentially — firing thirty write requests at
once is how an admin action becomes an outage.

**Visibility filtering is client-side and says so.** The endpoint has no such
parameter, so the server total can exceed the rows listed; the footer states
that rather than printing a number that disagrees with the table above it.

**New products default to hidden.** A half-finished product going live the
instant it is saved is the wrong default.

**The discount is previewed live in the form** — the operator sees what the
customer will see before saving, not after. A selling price above MRP is
rejected client-side, because it renders as a negative discount on the
storefront and reads as a pricing error to everyone who sees it.

### Legacy-required fields are shown, not defaulted

`author_id`, `publisher_id` and `language_id` are **required integers** on
create. A sofa has no author and no language, but the row cannot be written
without them. They sit in their own labelled section — "Required by the current
catalogue" — rather than behind a silent default, because a default nobody can
see is a data-quality problem that surfaces months later when someone asks why
every product was written by author 1.

Conversely, fields the brief calls for that have **no backend column at all** —
material, finish, colour, room, style, variants, assembly, warranty — are
absent rather than present-and-disabled. An input that cannot save is worse
than no input: it invites work that is silently discarded.

### Labelling is the design work here

The backend computes each dashboard figure with a carefully documented
definition, and several are only correct if the UI says what they cover. So
`StatTile` **requires** a `window` prop — every tile states its period, because
the same screen carries today, month-to-date, 30-day and all-time figures and
the backend's own notes warn that an all-time wishlist count beside a 30-day
cart count reads as parity when it is not.

Three specific traps this closed:

- `revenueChangePct` is **already** like-for-like — this month against the same
  elapsed days of last month. Labelling it "vs last month" would report a
  collapse for most of every month. It reads "vs same days last month", and
  both comparison figures are shown underneath.
- The days-to-dispatch delta is an **absolute difference in days**, and shipped
  briefly rendering as "−0.7%". `Delta` now takes a unit.
- Order-status shares **include cancelled orders**, as the backend intends;
  excluding them inflates every other share.

**Direction never rests on colour.** Up is not always good — dead stock and
days-to-dispatch invert — so each delta declares its own `goodWhen`, and an
arrow glyph accompanies the colour.

**Bars, not pies.** Shares are read by comparing lengths against a common
baseline; each row also carries its own count and percentage, so nothing
depends on reading the bar.

**Sample data is announced and cannot be dismissed.** A back office is exactly
where an invented figure gets screenshotted into a board pack, so the caveat
travels with the screenshot.

**The navigation shows build state.** Every section the brief calls for is
listed, each marked `ready`, `planned` (endpoint exists, screen outstanding) or
`blocked` (no backend capability). The two failure kinds get different
placeholder copy, because they call for different work — and an operator can
tell a gap in the build from a gap in the platform without asking.

---

## SEO infrastructure

**`robots.txt` disallows three groups**: private-to-one-person (account,
orders, cart, checkout, wishlist), near-infinite and thin (search — every query
string is a distinct URL with no unique content), and internal (admin, the
design-system reference).

Filtered listing URLs are deliberately **not** disallowed. They canonicalise to
the unfiltered page, which is the right signal; blocking them would stop the
crawler ever seeing the canonical tag that resolves them.

**The sitemap never throws.** A failing sitemap takes its route down, and a
build that dies because the catalogue API hiccuped is far worse than a sitemap
temporarily missing product URLs. Every dynamic section degrades to nothing on
failure; static routes always ship. Revalidated hourly, because a catalogue
changes and a sitemap pinned at deploy time is stale the first time someone
adds a product.

Rooms and live categories can name the same URL, so entries are de-duplicated —
a sitemap listing one URL twice is a validation error.

---

## Recently viewed

**Guests get a local list, because the API cannot serve them one.** The backend
tracks anonymous views, but writes every guest under a single shared `"guest"`
marker and `GET /catalog/recently-viewed` is customer-only — so a guest's views
are recorded and unreadable, by design. Signed-in customers read the canonical
20-per-customer list from the API; everyone else reads a local snapshot.

**The local list stores a snapshot, not just ids.** There is no public
"fetch these product ids" endpoint, so rebuilding from ids would cost one
request per product. That snapshot can go stale, so the rail is treated strictly
as a way back to the product and the product page remains the only authority on
price. The reconstructed card deliberately leaves rating and stock unset rather
than inventing them from a week-old visit.

**The rail renders nothing rather than an empty heading** — and on a product
page it excludes the product you are already on, since a one-entry rail
pointing at the current page looks broken.

---

## Loading, error and offline

Every API-driven surface routes through `lib/surfaceState.ts`, which resolves
one of five states: `loading`, `offline`, `error`, `empty`, `ready`. Two traps
it exists to close, both found by testing rather than by reading the code:

**`isLoading` is not "has no data".** It goes false during the backoff between
retry attempts while the query still has nothing. A component switching on it
falls through every branch and renders an empty band under its own heading —
no skeleton, no error, just a heading and nothing. `status === "pending"` is
the honest test.

**A paused query never errors.** TanStack holds a retrying query at
`status: "pending" / fetchStatus: "paused"`, and two different things cause it
(`query-core/retryer.ts`: a retry continues only while
`focusManager.isFocused() && (networkMode === "always" || onlineManager.isOnline())`):

- the tab is backgrounded — common, self-healing, and nobody is looking;
- the device is genuinely offline.

They must not be reported the same way. Telling a customer returning to a
backgrounded tab that they were offline is simply false, so only
`navigator.onLine === false` claims offline; a focus pause stays `loading`.
`navigator.onLine` is unreliable in the positive direction but reliable in the
negative, which is the only direction relied on here.

Queries and mutations run with `networkMode: "always"`. The store has no
offline cache to serve, so a request held back because the browser believes it
is offline just becomes an unexplained skeleton; attempting and failing gives
the customer a real error and a working retry.

---

## Imagery, and what is honest

The catalogue has at most one image per product and no furniture photography at
all (see `API-GAPS.md`). Missing images render as **deliberate line art on a
warm ground** — a considered empty state rather than a broken one, and
impossible to mistake for a photograph of the product being bought.

`NEXT_PUBLIC_DEMO_CONTENT=true` renders sample furniture (realistic names,
researched mid-market prices, internally consistent dimensions) so the
storefront can be designed against believable content. When it is on, a
**visible banner** says so. There is no configuration in which demo content can
be mistaken for live data by someone looking at the screen.

---

## Frontend-owned, pending backend

These are defined in `src/config/navigation.ts` because the backend has no
equivalent, and are a stopgap rather than a permanent home:

- the room taxonomy (Living / Bedroom / Dining / Study / Kids / Outdoor)
- mega-menu groupings and ordering
- "popular searches" in the search panel — chosen by merchandising, not derived
  from data, because there is no popularity endpoint

The newsletter form is deliberately **inert with an honest label**: there is no
subscribe endpoint, and wiring a form to a non-existent route fails silently at
the worst possible moment.
