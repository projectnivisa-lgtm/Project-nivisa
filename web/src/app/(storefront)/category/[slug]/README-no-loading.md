No `loading.tsx` in this segment — deliberate.

A `loading.tsx` creates a Suspense boundary, which makes Next stream the shell
as soon as the segment starts rendering. The 200 headers are then already on
the wire by the time `notFound()` throws, so a missing category renders the
404 page with a **200 OK** status: a soft 404 that search engines index as a
real page.

Measured on Next 16.3.3, production server:

    with    loading.tsx   /category/nonexistent -> 200   (soft 404)
    without loading.tsx   /category/nonexistent -> 404   (correct)

Correct status wins over an instant skeleton here: these pages are
server-rendered and fast, and a catalogue that returns 200 for every mistyped
or retired category URL accumulates indexed junk.

The same applies to /collection/[slug]. /shop and /search keep their
`loading.tsx` because neither can 404.
