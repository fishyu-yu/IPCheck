# Local network classification datasets

`vpn.json` is a normalized snapshot of the **strict VPN list** published by
[X4BNet](https://github.com/X4BNet/lists_vpn/blob/main/README.md). The MIT permission
below covers the scripts, source lists, and generated data. The broader X4B
datacenter list is deliberately not used: its non-eyeball classification does
not establish either a VPN connection or malicious activity.

`google-cloud.json` contains the public IPv4/IPv6 ranges published by Google at
<https://www.gstatic.com/ipranges/cloud.json>, documented in the
[Compute Engine FAQ](https://docs.cloud.google.com/compute/docs/faq#where_can_i_find_compute_engine_ip_ranges).
These identify customer-usable Google Cloud infrastructure, not malicious hosts
or all Google services. Google DNS addresses such as 8.8.8.8 are not Cloud ranges.

Run `node scripts/update-purity-data.mjs` to refresh both snapshots before a release.
Each file preserves the source URL, successful retrieval time, source publication
time where supplied, and a SHA-256 of its normalized prefix list and compiled
lookup intervals. IPv4 intervals are stored as exact 32-bit integers and IPv6
intervals as hexadecimal 128-bit values; matching uses binary search. X4B supplies no
publication timestamp; its `publishedAt` remains null. `verifiedAt` means that we
successfully retrieved and validated the source, not that each host was active.

The runtime expires VPN snapshots after 7 days and Cloud snapshots after 30 days;
expired or invalid data contributes no classification. Unmatched IPs remain
unknown. Network membership never establishes abuse or recent neighbor activity.

## X4B MIT License

Copyright (c) 2024 X4B (Mathew Heard)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
