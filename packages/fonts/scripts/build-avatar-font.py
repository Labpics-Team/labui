"""Reproduce the separately named, OFL rounded Avatar face from its pinned source."""
import argparse
import hashlib
from pathlib import Path
import urllib.request

from fontTools.ttLib import TTFont

SOURCE = 'https://raw.githubusercontent.com/anaclumos/sunghyun-sans/068baca3972cc211f3e606cd2cfca3ec60bba982/fonts/ttf/SunghyunSans-ExtraBold.ttf'
SHA256 = '1f34867ceb912e6638d2300eef9cb30261af21b75036292b4b27d303145767a1'

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, help='Existing pinned TTF; otherwise download it.')
args = parser.parse_args()
root = Path(__file__).resolve().parents[3]
native = root / 'native/compose/src/commonMain/composeResources/font/avatar_rounded_extrabold.ttf'
data = args.source.read_bytes() if args.source else urllib.request.urlopen(SOURCE).read()
assert hashlib.sha256(data).hexdigest() == SHA256, 'Avatar font source changed'
native.write_bytes(data)
font = TTFont(native, recalcTimestamp=False)
assert font['OS/2'].usWeightClass == 800
assert all(codepoint in font.getBestCmap() for codepoint in range(0x410, 0x450))
font.flavor = 'woff2'
font.save(root / 'packages/fonts/fonts/SunghyunSans-ExtraBold.woff2')
