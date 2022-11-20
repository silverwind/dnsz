/**
 * Parse a string of a DNS zone file and returns a `data` object.
 * @param {string} str The string of DNS zone file
 * @param {ParseOptions} [opts={}] Parse options
 * @returns {DnsData} The `data` object
 */
export function parseZone(str: string, { replaceOrigin, crlf, defaultTTL, dots }?: ParseOptions): DnsData;

/**
 * Parse a `data` object and return a string with the zone file contents.
 * @param {DnsData} data The `data` object.
 * @param {StringifyOptions} [opts={}] Parse options
 * @returns {string} The string with the zone file contents.
 */
export function stringifyZone(data: DnsData, { crlf, sections, dots }?: StringifyOptions): string;

export type DnsRecord = {
    /**
     * The lowercase DNS name without a trailing dot, e.g. `"example.com"`.
     */
    name: string;
    /**
     * The TTL in seconds, e.g. `60`.
     */
    ttl: number;
    /**
     * The DNS class, e.g. `"IN"`.
     */
    class: string;
    /**
     * The record type, e.g. `"A"`.
     */
    type: string;
    /**
     * The record content, e.g. `"2001:db8::1"` or `"example.com."`.
     */
    content: string;
    /**
     * A comment, e.g. `"a comment"`, `null` if absent.
     */
    comment: string | null;
};

export type DnsData = {
    /**
     * Array of `record`
     */
    records: DnsRecord[];
    /**
     * The value of `$ORIGIN` in the zone file.
     */
    origin?: string;
    /**
     * The value of `$TTL` in the zone file.
     */
    ttl?: number;
    /**
     * An optional header at the start of the file. Can be multiline. Does not include comment markers.
     */
    header?: string;
};

export type ParseOptions = {
    /**
     * When specified, replaces any `@` in `name` or `content` with it.
     */
    replaceOrigin?: string | null;
    /**
     * When true, emit `\r\n` instead of `\n` in `header`.
     */
    crlf?: boolean;
    /**
     * Default TTL when absent and `$TTL` is not present.
     */
    defaultTTL?: number;
    /**
     * Ensure trailing dots on FQDNs in content. Supports a limited amount of record types.
     */
    dots?: boolean;
};

export type StringifyOptions = {
    /**
     * Whether to group records into sections.
     */
    sections?: boolean;
    /**
     * When `true`, emit `\r\n` instead of `\n` for the resulting zone file.
     */
    crlf?: boolean;
    /**
     * Ensure trailing dots on FQDNs in content. Supports a limited amount of record types. Default: `false`.
     */
    dots?: boolean;
};
