import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { loadNavigation } from "@/lib/navigationSource";

/**
 * Storefront shell.
 *
 * Checkout deliberately lives outside this group: a checkout page keeps its
 * own stripped header with no navigation, because every link out of checkout
 * is an opportunity to abandon a nearly-complete order.
 *
 * The bottom padding on mobile clears the fixed bottom navigation so the last
 * row of the footer is never trapped underneath it. It wraps BOTH main and the
 * footer: on `main` alone it protected nothing, because the footer is what
 * actually ends the page and it renders after main. See `--space-bottom-nav`
 * for why the number is not a flat 3.5rem.
 *
 * The menu is fetched here, once, and handed to the header rather than
 * imported as a constant: it is built from the catalogue, so a category added
 * in the dashboard appears in the navigation without a release.
 */
export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nav = await loadNavigation();

  return (
    <>
      <AnnouncementBar />
      <Header sections={nav.sections} />
      <div className="pb-(--space-bottom-nav) lg:pb-0">
        <main id="main">{children}</main>
        <Footer />
      </div>
      <BottomNav />
    </>
  );
}
