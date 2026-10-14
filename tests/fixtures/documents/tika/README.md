# Apache Tika test documents

Real files made by Microsoft Office, Outlook, NeoOffice and a PDF writer, from the Apache Tika project's test suite at commit `7cb848a1ac9c3374ebaa909225ba2185a54ae074`. They check the readers against files no code of ours produced. Licensed under the Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0); copyright The Apache Software Foundation.

`fetch.sh` downloads them again and checks each sha256.

| File | Made by | Text the tests look for |
|---|---|---|
| testWORD.docx | Word | "This is a sample Microsoft Word Document.", header "This is the header for our document", footer "This is the footer for our document", "Nested table" |
| testWORD.doc | Word 97–2003 | the same body text; a HYPERLINK field whose result is "http://tika.apache.org/" |
| testPPT.pptx | PowerPoint | "Attachment Test", "Rajiv" |
| testEXCEL.xlsx | Excel X for Mac | "Sample Excel Worksheet - Numbers and their Squares" |
| test-outlook.msg | Outlook Express (8-bit strings) | subject "Nouvel utilisateur de Outlook Express", "Messagerie et groupes de discussion" |
| testOpenOffice2.odt | NeoOffice 2.2.1 | "This is a sample Open Office document" |
| testPDF.pdf | PDF 1.3 | "Tika" |
