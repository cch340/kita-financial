import { describe, it, expect } from 'vitest'
import { centsToDecimal, csvField, toCsv, assetCsvFilename } from './csv-shared'

describe('centsToDecimal', () => {
  it('formats positive cents with two decimals', () => {
    expect(centsToDecimal(123456)).toBe('1234.56')
    expect(centsToDecimal(5)).toBe('0.05')
    expect(centsToDecimal(0)).toBe('0.00')
  })
  it('formats negative cents', () => {
    expect(centsToDecimal(-1230)).toBe('-12.30')
    expect(centsToDecimal(-5)).toBe('-0.05')
  })
})

describe('csvField', () => {
  it('passes plain values through', () => {
    expect(csvField('hello')).toBe('hello')
    expect(csvField(1234)).toBe('1234')
  })
  it('renders null/undefined as empty', () => {
    expect(csvField(null)).toBe('')
    expect(csvField(undefined)).toBe('')
  })
  it('quotes fields with commas, quotes or newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('line1\nline2')).toBe('"line1\nline2"')
    expect(csvField('he said "hi"')).toBe('"he said ""hi"""')
  })
})

describe('toCsv', () => {
  it('joins header and rows with CRLF and escapes cells', () => {
    const csv = toCsv(
      ['Date', 'Vendor', 'Amount'],
      [
        ['2026-01-02', 'Cafe, Co', '12.50'],
        ['2026-01-03', 'Shop', '3.00'],
      ],
    )
    expect(csv).toBe(
      'Date,Vendor,Amount\r\n2026-01-02,"Cafe, Co",12.50\r\n2026-01-03,Shop,3.00',
    )
  })
})

describe('assetCsvFilename', () => {
  it('slugifies an ASCII asset name', () => {
    expect(assetCsvFilename('TreeO Condo', 'abc-123')).toBe('kita-asset-treeo-condo.csv')
  })
  it('falls back to the id when the name is all non-ASCII (all-CJK)', () => {
    expect(assetCsvFilename('房产', 'abc-123')).toBe('kita-asset-abc-123.csv')
  })
  it('falls back to the id when the name is empty', () => {
    expect(assetCsvFilename('', 'abc-123')).toBe('kita-asset-abc-123.csv')
  })
  it('trims leading/trailing separators from the slug', () => {
    expect(assetCsvFilename('  Myvi!!  ', 'x')).toBe('kita-asset-myvi.csv')
  })
})
