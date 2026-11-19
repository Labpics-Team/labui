# Pixel comparator controls before a cross-platform tolerance decision

Windows / Zulu 21 / headless SOFTWARE, diagnostic test commit `2643bf3`.
The typography production code is identical to `0d8cf27` and integrated `dd36c79`.

The positive run passes all three TextEllipsisInkRenderTest tests; every one of
the 18 prefix comparisons is exact, including six Badge and three paint wide/wide
calibrations. Those nine calibrations remain exact in both negative runs.

Two temporary, independent production mutations were then measured with the same
complete comparator. Both make both visual tests fail; changes were restored and
the three-test positive run passed again. Neither mutation is committed.

| Mutation / case | Changed pixels | Max R / G / B (0–255) |
|---|---:|---|
| Disable ink restoration / Badge (six density/scale cases) | 11 / 14 / 33 / 33 / 30 / 84 | 197–255 / 197–255 / 197–255 |
| Disable ink restoration / alpha | 66 | 104 / 64 / 40 |
| Disable ink restoration / brush | 66 | 28 / 153 / 148 |
| Disable ink restoration / shadow + underline | 112 | 146 / 100 / 70 |
| Repaint complete paragraph instead of Difference / Badge | 125 / 162 / 232 / 232 / 345 / 468 | 64 / 64 / 64 |
| Repaint complete paragraph instead of Difference / alpha | 1207 | 52 / 32 / 20 |
| Repaint complete paragraph instead of Difference / brush | 1207 | 12 / 64 / 63 |
| Repaint complete paragraph instead of Difference / shadow + underline | 2367 | 57 / 48 / 40 |

`windows-software/summary.tsv` records all 54 comparisons, including per-channel
counts and means. The PNG crops and `comparison.png` preserve the real-size visual
distinction: missing accents and visibly darker duplicate paint.

The exact assertions are unchanged. These controls establish sensitivity to the
two known defects; they do not establish a safe Linux/macOS tolerance. That decision
still requires the complete distributions and images from their diagnostic CI run.
