#!/bin/sh
# Fetches the Apache Tika test documents used by the reader tests and checks
# their sha256. Run from the repo root: sh tests/fixtures/documents/tika/fetch.sh
set -e
cd "$(dirname "$0")"
BASE="https://raw.githubusercontent.com/apache/tika/7cb848a1ac9c3374ebaa909225ba2185a54ae074/tika-parsers/tika-parsers-standard/tika-parsers-standard-modules"
MS="$BASE/tika-parser-microsoft-module/src/test/resources/test-documents"
for f in testWORD.docx testWORD.doc testPPT.pptx testEXCEL.xlsx test-outlook.msg; do curl -sfo "$f" "$MS/$f"; done
curl -sfo testOpenOffice2.odt "$BASE/tika-parser-miscoffice-module/src/test/resources/test-documents/testOpenOffice2.odt"
curl -sfo testPDF.pdf "$BASE/tika-parser-pdf-module/src/test/resources/test-documents/testPDF.pdf"
shasum -a 256 -c <<'SUMS'
ba546a434638c46fc6f1edd802c9084b95752afef2fa0aee8301388ab1f8131e  test-outlook.msg
960ba8f1cfa5838b563c369d281babe4ac0219100e00cecc93147fad22c549c3  testEXCEL.xlsx
daee7b62602780f2599c19b3593a1e455a21e041959416304c112bdb136640bb  testOpenOffice2.odt
8035bc3f748d8b97b8a9978bd812197bf40cf2b294a7e9b30e39d7167ddc720e  testPDF.pdf
730a6ade20208eaad375160949db37b2ffb52af4d3704b51976ff45564bff83b  testPPT.pptx
5ca19b67876f284a0e04ed06df44a004f850629a871fe522d014e1fdff912799  testWORD.doc
67797f5691cb5346201f1c40000a959f9f08d05d0b4493b4291e8d5f16e81e65  testWORD.docx
SUMS
