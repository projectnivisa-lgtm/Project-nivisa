"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocalStorageList } from "@/hooks/useLocalStorage";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { catalogApi } from "@/api/catalog";
import { queryKeys } from "@/lib/queryKeys";
import { cn, formatMoney } from "@/lib/utils";
import { ProductImage } from "@/components/commerce/ProductImage";

/**
 * Search with inline suggestions.
 *
 * An inline combobox, not a full-screen modal: the brief is right that a
 * takeover is intrusive, and on a furniture site search is a refinement tool
 * used mid-browse, not a destination. The panel drops beneath the field and
 * dismisses on Escape, blur or route change.
 *
 * Recent searches are held in localStorage — they are a per-device
 * convenience, not account data worth syncing, and the backend has no endpoint
 * for them.
 */

const RECENTS_KEY = "nivisa.recentSearches";
const MAX_RECENTS = 5;

/** Merchandising-chosen, not derived from data — there is no popularity API. */
const POPULAR = ["Sofa cum bed", "Queen mattress", "Study table", "Shoe rack"];

export function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [storedRecents, setRecents] = useLocalStorageList(RECENTS_KEY);
  const recents = storedRecents.slice(0, MAX_RECENTS);

  // 220ms: long enough that a normal typist issues one request per word,
  // short enough that the panel does not feel like it is lagging behind.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 220);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // The backend ignores queries under two characters and returns empty
  // buckets, so there is no point spending a request on them.
  const canQuery = debounced.length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.search.suggestions(debounced),
    queryFn: () => catalogApi.getSearchSuggestions(debounced),
    enabled: canQuery && isOpen,
    staleTime: 5 * 60_000,
  });

  function submit(value: string) {
    const query = value.trim();
    if (!query) return;
    setRecents([query, ...recents.filter((t) => t !== query)].slice(0, MAX_RECENTS));
    setIsOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  const hasResults =
    (data?.products.length ?? 0) +
      (data?.categories.length ?? 0) +
      (data?.brands.length ?? 0) >
    0;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit(term);
        }}
      >
        <label htmlFor="site-search" className="sr-only">
          Search for furniture and home products
        </label>
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            id="site-search"
            type="search"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setIsOpen(false);
            }}
            placeholder="Search sofas, beds, storage…"
            autoComplete="off"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            className="h-11 w-full rounded-sm border border-border-interactive bg-surface pl-10 pr-4 text-sm placeholder:text-ink-subtle focus:border-accent"
          />
        </div>
      </form>

      {isOpen ? (
        <div
          id={listId}
          className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-sm border border-border bg-surface shadow-pop"
        >
          {!canQuery ? (
            <div className="p-4">
              {recents.length > 0 ? (
                <Suggestions
                  heading="Recent searches"
                  items={recents}
                  onPick={submit}
                />
              ) : null}
              <Suggestions
                heading="Popular right now"
                items={POPULAR}
                onPick={submit}
              />
            </div>
          ) : isFetching && !data ? (
            <div className="space-y-3 p-4" aria-live="polite">
              <span className="sr-only">Searching</span>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="skeleton h-12 w-12 rounded-xs" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="skeleton h-3 w-3/5 rounded-xs" />
                    <div className="skeleton h-3 w-1/4 rounded-xs" />
                  </div>
                </div>
              ))}
            </div>
          ) : !hasResults ? (
            <div className="p-6 text-center">
              <p className="text-sm font-medium">
                Nothing matched “{debounced}”
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Try a broader word — “storage” instead of a model name.
              </p>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              {data!.products.length > 0 ? (
                <ul className="p-2">
                  {data!.products.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          router.push(`/product/${product.slug}`);
                        }}
                        className="flex w-full items-center gap-3 rounded-sm p-2 text-left transition-colors duration-fast hover:bg-surface-sunken"
                      >
                        <ProductImage
                          src={product.imageUrl}
                          alt=""
                          aspect="aspect-square"
                          className="h-12 w-12 shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {product.name}
                          </span>
                          <span
                            data-price
                            className="block text-xs text-ink-muted"
                          >
                            {formatMoney(product.price)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {data!.categories.length > 0 ? (
                <div className="border-t border-border p-3">
                  <p className="px-2 text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                    Categories
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data!.categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          router.push(`/category/${category.id}`);
                        }}
                        className="rounded-sm border border-border px-3 py-1.5 text-xs transition-colors duration-fast hover:border-ink"
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => submit(debounced)}
                className="block w-full border-t border-border p-3 text-center text-sm font-medium text-accent transition-colors duration-fast hover:bg-surface-sunken"
              >
                See all results for “{debounced}”
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Suggestions({
  heading,
  items,
  onPick,
}: {
  heading: string;
  items: string[];
  onPick: (value: string) => void;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="px-2 text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {heading}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPick(item)}
            className="rounded-sm border border-border px-3 py-1.5 text-xs transition-colors duration-fast hover:border-ink"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
