/**
 * Extract brand from station name
 * Examples:
 * - "Oryx Badalabougou" -> "Oryx"
 * - "Shell Hippodrome" -> "Shell"
 * - "Total Sébénicoro" -> "Total"
 */
export function extractBrandFromName(stationName: string, existingBrand?: string | null): string {
  // If brand is already set and valid, use it
  if (existingBrand && existingBrand.trim()) {
    return existingBrand.trim()
  }

  const name = stationName.trim()
  
  // Common brand prefixes in Mali
  const brandPatterns = [
    /^(Oryx|ORYX)\s/i,
    /^(Shell|SHELL)\s/i,
    /^(Total|TOTAL)\s/i,
    /^(BP)\s/i,
    /^(Mobil|MOBIL)\s/i,
    /^(Corridor|CORRIDOR)\s/i,
    /^(Yara|YARA)\s/i,
    /^(BCF)\s/i,
    /^(CDS)\s/i,
    /^(KDF)\s/i,
    /^(Amazone|AMAZONE)\s/i,
    /^(Birgo|BIRGO)\s/i,
    /^(Comap|COMAP)\s/i,
    /^(CAM HOLDING|Cam Holding)\s/i,
    /^(2Holding|2HOLDING)\s/i,
    /^(ADF)\s/i,
  ]

  for (const pattern of brandPatterns) {
    const match = name.match(pattern)
    if (match) {
      // Capitalize first letter, lowercase rest
      const brand = match[1]
      return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase()
    }
  }

  // Default: return empty string (will use default pump icon)
  return ''
}

/**
 * Get brand slug for image/icon lookup
 */
export function getBrandSlug(brand: string): string {
  return brand.toLowerCase().replace(/\s+/g, '-')
}

