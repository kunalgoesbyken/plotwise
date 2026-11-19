# Bangkok building-envelope rules: primer for the Plotwise tool

Prepared 2026-11-19 from 8 Context.dev calls (hard cap reached). Status tags: **VERIFIED** means I saw the number in a primary source text. **VERIFIED-2ND** means I saw it only in a secondary summary. **UNVERIFIED** means I did not see it, so do not hard-code it.

Primary-source PDF text came from the Architects' Association (ASA) mirror of the Royal Gazette files. I did not reach ratchakitcha.soc.go.th directly.

---

## 1. Which Bangkok Comprehensive Plan is in force on 2026-11-19

**Answer: the B.E. 2556 (2013) plan is still the operative plan.** It is the Ministerial Regulation enforcing the Bangkok Comprehensive Plan B.E. 2556, published in the Royal Gazette vol. 130, part 41 ก, 16 May 2556 (2013). The B.E. 2556 text was amended by one Bangkok Metropolitan bylaw dated 13 March 2569 (2026). The new "4th revision" plan has **not** been gazetted. Confidence is about 85%. The 2569 bylaw's text was garbled (see 1b), so what it changes is unconfirmed.

**1a. The B.E. 2556 plan is the base document.**
- Source: ASA, https://asa.or.th/laws-and-regulations/cpa/ (page last modified 2026-07-16, which is after the 2026 bylaw). It lists "กฎกระทรวงให้ใช้บังคับผังเมืองรวมกรุงเทพมหานคร พ.ศ. 2556 (16 พ.ค. 56)" as the current instrument.
- Primary header text, from the PDF itself: "หน้า ๒๐ เล่ม ๑๓๐ ตอนที่ ๔๑ ก ราชกิจจานุเบกษา ๑๖ พฤษภาคม ๒๕๕๖" ("page 20, vol. 130, part 41 ก, Royal Gazette, 16 May 2556"). Source: http://download.asa.or.th/03media/04law/cpa/mr56-bma.pdf.
- A correction notice dated 9 Oct 2556 also exists (mr56-correction.pdf). The ASA page says: "(เฉพาะ text) มีแก้คำผิดที่ท้ายเอกสาร" ("text only, corrections at the end").

**1b. A 2569 bylaw amended it.**
- ASA lists "ข้อบัญญัติกรุงเทพมหานคร เรื่อง ให้ใช้บังคับผังเมืองรวมกรุงเทพมหานคร พ.ศ. 2569" with the note "แก้ไขผังเมืองรวมกรุงเทพมหานคร 2556" ("amends the 2556 plan").
- Gazette header, verified: "หน้า ๔๐ เล่ม ๑๔๓ ตอนพิเศษ ๖๖ ง ราชกิจจานุเบกษา ๑๓ มีนาคม ๒๕๖๙" (vol. 143, special part 66 ง, 13 March 2569 = **13 March 2026**, pages 40-44). URL: https://download.asa.or.th/03media/04law/cpa/bb69-bma.pdf.
- The extracted body text was font-garbled, so I could not read the operative articles. What is readable is the annex: "บัญชีท้ายข้อบัญญัติกรุงเทพมหานคร ... พ.ศ. ๒๕๖๙", a per-zone table of **factory** types (item 76 rail-vehicle workshops, item 90 water-supply plants) across ย.๑ to ก.5.
- My reading is that the bylaw edits permitted uses (factories) and not FAR or OSR. That reading is **UNVERIFIED**. Someone with Thai-reading access should open the PDF and confirm before the tool is called "complete".

**1c. The revised plan (4th revision, "ปรับปรุงครั้งที่ 4") is a draft only.**
- 90-day public posting runs 10 Aug to 7 Nov 2026. Source: https://www.thansettakij.com/real-estate/666034 (snippet: "ผังกทม.ใหม่ปิดประกาศ 90 วัน 10 ส.ค. -7 พ.ย.69 ... คาดการณ์ว่าจะประกาศใช้ได้ประมาณปลายปี 2570").
- A second Thansettakij article (https://www.thansettakij.com/real-estate/669687) gives the end date as 9 Nov 2026.
- Expected gazette date is **late 2027**. Source: https://policywatch.thaipbs.or.th/article/agriculture-62 ("ก่อนเดินหน้าประกาศใช้ปลายปี 2570"). A third article says "เลื่อนการประกาศใช้จากปี 2569 เป็นปี 2570" (https://www.thansettakij.com/real-estate/650682).
- The Bangkok City Planning Committee approved the draft on 9 Apr 2026 (https://www.thansettakij.com/real-estate/659109).
- The draft drops the FAR-transfer (TDR) measure between plots and cuts planned roads from 148 to 96 (policywatch link above). This is a draft and **must not** drive today's numbers.
- Earlier (2025) press said "ประกาศใช้ พ.ย.68" (https://www.bangkokbiznews.com/property/1143975). That slipped, and no gazette evidence exists for it.

**For the tool:** treat the dataset as "B.E. 2556 plan, as amended 13 Mar 2026". Show a banner: "draft 4th revision pending, expected late 2027".

---

## 2. Zone system and FAR / OSR

Definitions, all verified in the primary regulation:
- **FAR** is "อัตราส่วนพื้นที่อาคารรวมต่อพื้นที่ดิน", the total floor area of all storeys over the land area. Example in zone ย.9: "ไม่เกิน ๗ : ๑".
- **OSR** is "อัตราส่วนของที่ว่างต่อพื้นที่อาคารรวม", open space over **total floor area (GFA), not over the plot**. Example for ย.10: "ไม่น้อยกว่าร้อยละสี่" (at least 4%).
- Every zone clause adds the same two guard rules, which I saw repeated in the text:
  - Open space may not fall below the Building Control Act minimum for "ที่ว่างอันปราศจากสิ่งปกคลุม" (open space free of cover). Quote: "แต่อัตราส่วนของที่ว่างต้องไม่ต่ำกว่าเกณฑ์ขั้นต่ำของที่ว่างอันปราศจากสิ่งปกคลุมตามกฎหมายว่าด้วยการควบคุมอาคาร".
  - "ให้มีพื้นที่น้ำซึมผ่านได้เพื่อปลูกต้นไม้ไม่น้อยกว่าร้อยละห้าสิบของพื้นที่ว่าง" (at least 50% of the open space must be permeable and plantable).
- Anti-splitting clause, quoted: "ที่ดินแปลงใดที่ได้ใช้ประโยชน์แล้ว หากมีการแบ่งแยกหรือแบ่งโอนไม่ว่าจะกี่ครั้งก็ตาม อัตราส่วนพื้นที่อาคารรวมต่อพื้นที่ดิน ของที่ดินแปลงที่เกิดจากการแบ่งแยก ... ต้องไม่เกิน" (once a plot has been developed, any later subdivision keeps the combined FAR of all resulting plots within the cap).

**Zone table.** Source: ISA summary table (secondary) http://download.asa.or.th/03media/04law/cpa/BMA_LandUse_2556.pdf, row "F.A.R. ไม่เกิน ( : 1)" and row "O.S.R. ไม่น้อยกว่า (ร้อยละของพื้นที่อาคารรวม)", page 1. The table is dated "16 พฤษภาคม 2556" and carries a disclaimer: "ผู้ใช้ควรตรวจสอบจากกฎกระทรวงต้นฉบับด้วย" (users should check the original regulation). I cross-checked the primary text in the PDF mr56-bma.pdf. Where a primary value matched, I marked the row "P".

| Zone | Colour and type | FAR max (:1) | OSR min (% of GFA) | Primary check |
|---|---|---|---|---|
| ย.1 | yellow, low density | 1 | 40 | ISA only |
| ย.2 | yellow, low density | 1.5 | 20 | ISA only |
| ย.3 | orange, medium density | 2.5 | 12.5 | P (2.5:1, 12.5%) |
| ย.4 | orange, medium | 3 | 10 | P (3:1, 10%) |
| ย.5 | orange, medium | 4 | 7.5 | P (4:1) |
| ย.6 | orange, medium | 4.5 | 6.5 | P (4.5:1) |
| ย.7 | orange, medium (transit-adjacent) | 5 | 6 | P (5:1) |
| ย.8 | brown, very high (inner city, scenery and nature conservation) | **6** | **5** | P (p.43, "๖ : ๑", "ร้อยละห้า") |
| ย.9 | brown, very high (inner city, mass-transit catchment) | **7** | **4.5** | P ("๗ : ๑", "สี่จุดห้า") |
| ย.10 | brown, very high (next to the central business district and mass transit) | **8** | **4** | P ("๘ : ๑", "ร้อยละสี่") |
| พ.1 | red, commercial | 5 | 6 | ISA only |
| พ.2 | red | 6 | 5 | ISA only |
| พ.3 | red | 7 | 4.5 | P (p.46 "๗ : ๑", "สี่จุดห้า"; zone label cut off) |
| พ.4 | red | 8 | 4 | ISA only |
| พ.5 | red | 10 | 3 | ISA only |
| อ.1-3 | purple, industrial | 2 / 1.5 / 1 | 15 / 20 / 40 | ISA only |
| ก.1-ก.5 | green, rural and agriculture | 0.5 / 1 / 0.5 / 1 / 1 | 100 / 40 / 100 / 40 / 40 | P (0.5:1 with 100%) |
| ศ.1-2 | light brown, Thai heritage | 3 / 4 | 10 / 7.5 | ISA only |

Notes on the table:
- The ย.8, ย.9 and ย.10 descriptions ("ที่อยู่อาศัยหนาแน่นมาก" and the catchment wording) are quoted from the primary text.
- ย.7 is described in the primary text as "ที่อยู่อาศัยหนาแน่นปานกลาง" (medium density).
- I matched primary FAR/OSR passages to zones by their order in the regulation, and the headers were not always in the extracted snippets. The ISA table is the only explicit zone-to-number mapping, and it agrees with every primary number I saw. So ย.8 to ย.10 are "verified as numbers, mapping confirmed by agreement".
- Colours for the ย.1 to ย.7 sub-bands are from the ISA legend and were read from garbled layout. The brown ย.8 to ย.10 and red พ.1 to พ.5 mapping is firm.

**Sub-zones.** The map uses sub-codes such as ย.7-4 or ย.2-11. The conditions notes in the ISA table refer to them (for example "เฉพาะในบริเวณ ย.1-1"). The plan's map is the lookup. ASA hosts a land-use map page: http://download.asa.or.th/03media/04law/cpa/BMAlanduse/bma-landuse56b.htm.

**FAR bonus.**
- ISA legend says all bonus types combined may raise FAR by **at most 20%**: "ทุกแบบรวมกัน เพิ่ม FAR ได้ไม่เกินร้อยละ 20". The listed bonus types are low-income housing, public open space, public parking, flood retention, and energy-conserving buildings. The legend was partly garbled, so treat the list as **VERIFIED-2ND, incomplete**.
- Primary clause text (the start of the clause was cut off, so which zones it covers is **partial**): "ย.๘ ถึง ย.๑๐ และประเภท พ.๒ ถึง พ.๕ การใช้ประโยชน์ที่ดินประเภทอาคารสาธารณะตามกฎหมายว่าด้วยการควบคุมอาคาร หากเจ้าของที่ดินหรือผู้ประกอบการได้จัดให้มีพื้นที่โล่งเพื่อประโยชน์สาธารณะหรือสวนสาธารณะในแปลงที่ดินที่ขออนุญาต ให้มีอัตราส่วนพื้นที่อาคารรวมต่อพื้นที่ดินเพิ่มได้ไม่เกินร้อยละยี่สิบ โดยพื้นที่อาคารรวมที่เพิ่มขึ้นต้องไม่เกินห้าเท่าของพื้นที่โล่งเพื่อประโยชน์สาธารณะหรือสวนสาธารณะที่จัดให้มีขึ้น"
- English: in ย.8 to ย.10 (and พ.2 to พ.5), for "public buildings" as defined in the Building Control law, if the owner provides public open space or a public park on the plot, FAR may rise by **up to 20%**, and the extra floor area may not exceed **5 times** the public open space provided.
- Whether a condo counts as an "อาคารสาธารณะ" (public building) is **UNVERIFIED**. Do not assume the bonus applies to residential condos.
- The other bonus rules (low-income housing, parking, retention, energy) are **UNVERIFIED** in detail. I did not see their clause text.

**Road-width conditions per use.** The ISA legend gives the condition codes: 1a road right-of-way (ROW) at least 10 m, 1b at least 12 m, 1c at least 16 m, 1d at least 30 m, code 2 within 500 m of a mass-transit station. The per-zone placement for apartment/condo (อาคารอยู่อาศัยรวม) size bands (1,000 / 2,000 / 5,000 / 10,000 m²) was misaligned in the extraction. **The condo-size-by-road-width matrix for ย.8 to ย.10 is UNVERIFIED.** Read the original regulation (clauses for each zone, plus ข้อ ๓๖ on road conditions).
- One primary rule that I did see, ข้อ ๓๖(๑): a plot on a road with ROW of at least 10 m must have a side at least 12 m wide on that road ("ที่ดินแปลงใดแปลงหนึ่งซึ่งมีด้านใดด้านหนึ่งกว้างไม่น้อยกว่า ๑๒ เมตร"). Other tiers (16 m, 30 m) have similar frontage tests, and a 300 m access-route test for 16 m roads. Details were truncated, so **UNVERIFIED**.

---

## 3. Building-control rules that apply on top of zoning

**What I could verify.** The updated Ministerial Regulation No. 55 (B.E. 2543) text is hosted at https://download.asa.or.th/03media/04law/cba/mr/mr43-55-upd68.pdf (ASA, "upd68" suggests updated to 2568). I only saw excerpts in a search result, so most numbers below are **UNVERIFIED**.

**Verified definitions, Reg. 55:**
- Large building ("อาคารขนาดใหญ่"): "อาคารที่มีพื้นที่รวมกันทุกชั้นหรือชั้นหนึ่งชั้นใดในหลังเดียวกันเกิน 2,000 ตารางเมตร หรืออาคารที่มีความสูงตั้งแต่ 15.00 เมตรขึ้นไป และมีพื้นที่รวมกันทุกชั้นหรือชั้นหนึ่งชั้นใดในหลังเดียวกันเกิน 1,000 ตารางเมตร แต่ไม่เกิน 2,000 ตารางเมตร". English: more than 2,000 m² total or on any one floor; or at least 15 m high with more than 1,000 m² (up to 2,000 m²).
- Height measurement: "วัดจากระดับพื้นดินที่ก่อสร้างถึงพื้นดาดฟ้า สำหรับอาคารทรงจั่วหรือปั้นหยาให้วัดจากระดับพื้นดินที่ก่อสร้างถึงยอดผนังของชั้นสูงสุด" (ground to roof slab; for gable or hip roofs, ground to top of the highest storey's wall). Source: the search snippet of mr43-55-upd68.pdf.
- Residential-rise definition: "อาคารอยู่อาศัยรวม" is a building used as a residence for several families in separate units.
- Plan-level note: the 2556 plan keeps its own height cap of 12 m (road to top of wall of the highest storey) for the low-density zones only. I saw this for ย.1 to ย.2-type clauses, not for ย.8 to ย.10.

**Secondary, not authoritative (APThai blog, https://www.apthai.com/th/blog/know-how/what-is-building-setback-regulations):** "ถนนกว้างน้อยกว่า 6 เมตรให้อาคารทุกประเภทร่นจากกึ่งกลางถนนอย่างน้อย 3 เมตร ... ถนนกว้าง 10-20 เมตรต้องร่นจากเขตถนนไม่น้อยกว่า 1/10 ของความกว้างถนน และถนนกว้างมากกว่า 20 เมตรต้องร่นจากเขตถนนไม่น้อยกว่า 2 เมตร". The blog's own wording is internally tangled (it mixes building height and road width), so treat it as **a lead, not a rule**.

**Not seen in any source this session, so UNVERIFIED (do not hard-code):**
- Setback from the plot boundary by building height or type. A builder-facing note: ย.8 to ย.10 plan clauses did not show a flat "2 m all around" in my extracts, but the low-density zones do ("ที่ว่างโดยรอบอาคารไม่น้อยกว่า ๒ เมตร").
- Setback from the road, and height vs distance to the opposite side of the road.
- Minimum road width and ROW for high-rise (the brief says at least 23 m high) and for large buildings (the brief says 10,000 m² or 2,000 m² per floor). Only the 2,000 m² definition above was seen.
- Open-space and building-coverage rules in Reg. 55 beyond the plan's OSR. The plan text points to the Building Control law's minimum, whose value I did not see.
- Ministerial Regulation No. 33 (high-rise definition) and No. 7 parking rules.

**Next step for the team:** run one targeted read of `mr43-55-upd68.pdf` (pages for the setback, height and road-width articles) and the Reg. 33 text to fill these. I had no calls left.

---

## 4. Condo-specific: EIA and extras

- EIA threshold (units or floor area) for residential/condo projects: **UNVERIFIED**. No source seen. Look up the Ministry of Natural Resources and Environment notice on project types requiring an EIA (the "ประกาศกระทรวงทรัพยากรธรรมชาติและสิ่งแวดล้อม เรื่อง กำหนดประเภทและขนาดของโครงการ ... ที่ต้องเสนอรายงาน EIA") and quote the clause.
- Parking minimums for condos: **UNVERIFIED**.
- Plan-level extras I did see for apartment/condo: the size bands and road-width or station tests in the ISA table (section 2), and the rule that at least 50% of the open space must be permeable and plantable.
- A condo of more than 10,000 m² total floor area is the top size band in the ISA matrix, so expect the strictest road-width or station test there (**UNVERIFIED** per zone).

---

## 5. Recommended zone: ย.9 (brown, very high density, mass-transit catchment)

**Why ย.9:**
1. **Meaningful, non-trivial FAR/OSR.** FAR 7:1 and OSR 4.5% (both seen in the primary text). On a 3,200 m² plot that is 22,400 m² GFA and at least 1,008 m² of open space, with at least 50% of that open space permeable and plantable. So the tool must handle three coupled constraints (FAR, OSR as a share of GFA, permeable share).
2. **Several rules interact.** Road-width and 500 m station conditions (codes 1a-1d and 2), the up-to-20% FAR bonus with a "5x public open space" cap, and the anti-subdivision clause give the checker real logic to build. It sits between ย.8 (FAR 6) and ย.10 (FAR 8), so the logic generalises to the other two brown zones by changing two numbers.
3. **Condo-relevant.** The plan text says ย.9 is for inner-city living "ในเขตการให้บริการของระบบขนส่งมวลชน" (within the mass-transit service area), which is where condos are built.

**Example area.** I could not verify a real ย.9 location in this session. Candidates from general knowledge (UNVERIFIED): inner-city corridors beside BTS/MRT lines such as the Ratchadaphisek, Sukhumvit and Phaya Thai strips. Confirm any specific plot on the plan's map page (the ASA mirror linked in section 2, or the Bangkok City Planning Department site) before showing it as an example. Alternatively use ย.10 if you want a CBD-edge example (FAR 8, OSR 4).

---

## Open questions a builder must decide

1. **Which road width counts?** The plan uses "ขนาดเขตทาง" (right-of-way) and reads it from the map's road schedule, not from the paved width. Which ROW applies when a plot touches two roads, or a soi widened later?
2. **How the plan's FAR and the building-control setbacks combine.** The plan caps FAR and sets OSR; Reg. 55 sets boundary and road setbacks, height-to-road ratios, and building coverage. The envelope is the intersection of all of them. I could not verify the Reg. 55 numbers.
3. **Gross plot or net plot for FAR?** The primary text says "พื้นที่ดิน" (land area). Whether road-widening strips ceded to the road count in that area is **UNVERIFIED**.
4. **Which floor-area definition** counts toward "พื้นที่อาคารรวม" (parking floors, balconies, plant rooms)? This drives both FAR and OSR. **UNVERIFIED**.
5. **Does the up-to-20% bonus apply to residential condos**, given the clause says "อาคารสาธารณะ"?
6. **What exactly the 13 Mar 2026 bylaw changed.** I could not read it.
7. **Pending draft:** a permit filed before late 2027 follows the B.E. 2556 text; check whether the permit-filing date or the effective date controls if the plan changes mid-project.

## Three common mistakes

1. **Applying the 2556 FAR to the whole plot without the anti-subdivision rule.** If a plot was already developed and then split, the FAR cap applies jointly to the resulting plots. Check parcel history.
2. **Reading OSR as a share of the plot.** It is a share of the building's total floor area ("ของพื้นที่อาคารรวม"). A 7:1 building at 4.5% OSR needs open space equal to 4.5% of GFA, and at least half of it must be permeable greenery.
3. **Using the draft 4th revision or the press timeline.** Articles repeatedly said the new plan would be "ประกาศใช้ พ.ย.68" (Nov 2025). It slipped, and nothing is gazetted. Also, a big site on a small soi can be barred outright by the road-width tests even if FAR allows it.

## Primary-source PDFs (direct URLs, not downloaded)

- B.E. 2556 plan, Ministerial Regulation text, Royal Gazette 130/41 ก, 16 May 2556: http://download.asa.or.th/03media/04law/cpa/mr56-bma.pdf
- Correction notice (9 Oct 2556): http://download.asa.or.th/03media/04law/cpa/mr56-correction.pdf
- Bangkok bylaw enforcing the plan, B.E. 2569 (13 Mar 2026), Royal Gazette 143/66 ง pp. 40-44: https://download.asa.or.th/03media/04law/cpa/bb69-bma.pdf
- ISA zone summary table (secondary, unofficial): http://download.asa.or.th/03media/04law/cpa/BMA_LandUse_2556.pdf
- Land-use map page, 2556 plan: http://download.asa.or.th/03media/04law/cpa/BMAlanduse/bma-landuse56b.htm
- Ministerial Regulation No. 55 (B.E. 2543), updated text: https://download.asa.or.th/03media/04law/cba/mr/mr43-55-upd68.pdf
- City Planning Act B.E. 2562: http://download.asa.or.th/03media/04law/cpa/cpa62.pdf
- Bangkok City Planning and Urban Development Dept. page for the 2556 regulation: https://webportal.bangkok.go.th/cpud/page/sub/25970/ (full path with Thai slug appeared in search results)
- Reg. 55 text on Longdo Law (HTML): http://law.longdo.com/law/179/sub13869

Not found: a direct ratchakitcha.soc.go.th URL for either the 2556 regulation or the 2569 bylaw.
