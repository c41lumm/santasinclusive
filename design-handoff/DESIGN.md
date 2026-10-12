# Santa's Inclusive Grotto: design handoff

These are the approved designs for the new site, exported from the Claude design canvas.
Build the real site to match them. Treat the files in `designs/` as the visual source of truth, not as production code.

## What's here

- `designs/*.dc.html`: one file per screen. Each is plain HTML with inline styles. Ignore the `<x-dc>`, `<helmet>`, `<sc-if>`, `<sc-for>` wrapper tags and the `support.js` script; they belong to the design tool. The markup, copy, spacing and colours inside are what to copy. `{{ name }}` style holes are sample data.
- `designs/canvas.json`: list of screens with their titles and frame sizes.
- `assets/`: every image the designs use (logo, badge, Santa illustrations, photos). File names match the references in the HTML.

## Screens

Public site
- `HomeV2.dc.html`: homepage (what to expect, booking, finding us, get involved, testimonials)
- `ChildForm.dc.html`: "About your child" form after booking
- `Confirmation.dc.html`: booking confirmed page
- `Waitlist.dc.html`: waitlist flow (join, on the list, slot opened message)
- `GroupBookings.dc.html`: schools and group visits
- `Support.dc.html`: support the grotto (toy sponsorship)
- `Volunteer.dc.html`: volunteer application for Santas and elves

Staff
- `ElfApp.dc.html`: elf web app (phone)
- `AdminBookings.dc.html`, `AdminSlots.dc.html`, `AdminChecks.dc.html`, `AdminToys.dc.html`, `AdminRota.dc.html`: admin area

Brand
- `Logo.dc.html`, `HorizontalLogo.dc.html`: logo usage and colours

## Design tokens

Fonts (Google Fonts)
- Headings: Fredoka 600/700
- Body: Atkinson Hyperlegible 400/700, 18px, line-height 1.6

Colours
- Grotto Green (primary, links, icons): #067E3E
- Santa Red (main buttons): #C8000B (logo red #DE000C)
- Page background (cream): #FBF6EE
- Card background: #FFFFFF, card border: #E7DCC8
- Text: #1E2B2A, secondary text: #45524F, input borders: #5B6B68
- Pale green panels: #E6F2E8 / #DDEBE1
- Footer: #0B3B21
- Warning panel: #FFF7E6 with #E8B44C border
- Focus ring: 3px solid #1B1B1B, offset 3px

Shape
- Cards: 28px radius, 32px padding
- Buttons and pills: fully rounded (999px), min height 48 to 52px
- Inputs: 12px radius, 2px border, min height 48px
- Page max width about 1140 to 1240px, 40px side padding

Accessibility rules the designs follow (keep them)
- Real `<button>`, `<a>`, `<label>` + `<input>` everywhere
- Touch targets at least 44px
- Text contrast at least 4.5:1
- Calm, no autoplay or flashing; layouts stack at phone width
