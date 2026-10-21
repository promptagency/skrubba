// Swedish towns and provinces, for compounds the model misses when the place
// does not stand alone in the text ("Malmöbor", "Stockholmskontoret"). Only
// names of four letters or more, and only in front of a listed compound tail
// (see placeCompound), so a surname like Lundgren is never cut.
export const PLACES: readonly string[] = (
  "Stockholm Göteborg Malmö Uppsala Västerås Örebro Linköping Helsingborg Jönköping Norrköping Lund Umeå Gävle " +
  "Borås Södertälje Eskilstuna Halmstad Växjö Karlstad Sundsvall Östersund Trollhättan Luleå Lidingö Borlänge " +
  "Kristianstad Kalmar Falun Skövde Karlskrona Skellefteå Uddevalla Varberg Åkersberga Örnsköldsvik Landskrona " +
  "Nyköping Motala Vallentuna Trelleborg Ängelholm Karlskoga Lerum Alingsås Sandviken Kungsbacka Visby Enköping " +
  "Katrineholm Falkenberg Ystad Piteå Hudiksvall Kiruna Boden Ludvika Köping Mölndal Partille Kungälv Nacka Täby " +
  "Solna Sollentuna Huddinge Haninge Järfälla Botkyrka Norrtälje Sigtuna Märsta Värnamo Härnösand Lidköping " +
  "Mariestad Vänersborg Oskarshamn Västervik Nässjö Tranås Vetlanda Ljungby Älmhult Hässleholm Eslöv Höganäs Lomma " +
  "Staffanstorp Kävlinge Svedala Vellinge Simrishamn Sölvesborg Karlshamn Ronneby Nybro Arboga Fagersta Avesta " +
  "Söderhamn Bollnäs Kramfors Sollefteå Timrå Strömsund Lycksele Gällivare Kalix Haparanda Säffle Arvika " +
  "Kristinehamn Filipstad Hagfors Torsby Falköping Tidaholm Ulricehamn Kinna Skara Götene Strömstad Lysekil " +
  "Stenungsund Mölnlycke Kungsängen Bålsta Gnesta Strängnäs Mariefred Oxelösund Finspång Mjölby Vadstena " +
  "Åtvidaberg Söderköping Sundbyberg Danderyd Tyresö Upplands Värmdö Ekerö Vaxholm Österåker Nynäshamn Salem " +
  "Skåne Småland Blekinge Halland Bohuslän Dalsland Västergötland Östergötland Gotland Öland Södermanland Uppland " +
  "Västmanland Närke Värmland Dalarna Gästrikland Hälsingland Härjedalen Jämtland Medelpad Ångermanland " +
  "Västerbotten Norrbotten Lappland Norrland Svealand Götaland Sörmland Roslagen Bergslagen Österlen"
).split(" ");
