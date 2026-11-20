import type { Assumption } from '@/solve/assumptions'
import type { Plot } from './plot'

export const EXAMPLE_PLOT: Plot = {
  ring: [
    [100.575355, 13.77867],
    [100.57568, 13.778661],
    [100.575694, 13.779116],
    [100.575382, 13.779044],
  ],
  roads: [
    { edge: 0, widthM: 12 },
    { edge: 1, widthM: 5 },
    { edge: 3, widthM: 5 },
  ],
  buildingType: 'condo',
  nearStation: false,
}

export const MUMBAI_EXAMPLE_PLOT: Plot = {
  ring: [
    [72.949512, 19.1804679],
    [72.9495111, 19.1801672],
    [72.950255, 19.1800471],
    [72.9503071, 19.1803113],
  ],
  roads: [
    { edge: 0, widthM: 12 },
    { edge: 1, widthM: 5 },
  ],
  buildingType: 'condo',
  nearStation: false,
}

export const MUMBAI_EXAMPLE_LAND_RATE: Assumption = {
  value: 64_240,
  source:
    'Department of Registration and Stamps, Government of Maharashtra, Annual Statement of Rates (Ready Reckoner) 2026-27, Mumbai Suburban district, village Mulund (W), open land ₹64,240 per m² in zone 123/567. The zone is matched by position and not confirmed for this plot: on OpenStreetMap the plot lies between L.B.S. Marg and Purushottam Kheraj Road, which zone 123/567 covers: "एल.बी.एस.मार्ग व पुरूषोत्तम खेराज रोड या मधील विभाग क्रमांक 123/568 मधील मिळकती सोडून उर्वरीत सर्व मिळकती" (all properties between L.B.S. Marg and Purushottam Kheraj Road except those of zone 123/568); if it lies in zone 123/568 the rate is ₹63,400. https://easr.igrmaharashtra.gov.in/eASRCommon.aspx?hDistName=Bombaymains, fetched 2026-11-20',
}

export const DUBAI_EXAMPLE_PLOT: Plot = {
  ring: [
    [55.2095575, 25.0605486],
    [55.2094672, 25.0600975],
    [55.209891, 25.0600157],
    [55.2099585, 25.0604223],
  ],
  roads: [
    { edge: 2, widthM: 5 },
    { edge: 3, widthM: 8 },
  ],
  buildingType: 'condo',
  nearStation: false,
  limits: { maxFar: 3.5, maxStoreys: 9, maxCoverageShare: 0.6, roadSetbackM: 0, boundarySetbackM: 3 },
}

export const DUBAI_EXAMPLE_LIMITS_SOURCE =
  'Setbacks and plot coverage copied from a public Nakheel affection plan, not this plot’s own: Trakhees site plan issued 12 May 2026 for International City Phase 1 plot IC1-CTYL-16_013, mixed use (residential with retail), FAR 3.5: "Podium setback: 0.00m from all Sides; Tower setback: Front = 0.00m, Sides =:3.00m" and "Plot coverage: Podium: 100% , Tower : 60%"; the tower figures are used because these designs have no podium. That plan gives height in floors only and refers parking to the Trakhees regulations, so height in metres and parking stay blank. Published by the Consulate General of India, Dubai, https://www.cgidubai.gov.in/content/Affection-plan-Updated%20-IC1-CTYL-16_013_12.05.2026.pdf, fetched 2026-11-20'
