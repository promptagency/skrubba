// Companies and brands people in Sweden write about, for the model's NAMN
// spans only: the model types a company it does not know as a person now and
// then ("Pitchen för Arla gick bra"). Names that are also a first name, a
// surname or an ordinary word (Max, Hedin, Kia, If, Tre) are left out, since a
// person with that name would be typed as a company.
export const KNOWN_ORGANISATIONS: ReadonlySet<string> = new Set(
  (
    "arla essity ikea lidl volvo scania ericsson telia tele2 seb swedbank nordea handelsbanken ica coop axfood " +
    "spotify klarna skanska ncc peab sandvik skf abb electrolux husqvarna securitas sca boliden ssab saab vattenfall " +
    "postnord systembolaget apoteket skandia folksam länsförsäkringar willys hemköp elgiganten åhléns lindex byggmax " +
    "jula biltema rusta preem okq8 telenor bahnhof viaplay tv4 svt bonnier schibsted aftonbladet expressen mathem " +
    "foodora microsoft google apple amazon meta facebook instagram linkedin tesla accenture capgemini cgi tietoevry " +
    "knowit netlight mckinsey deloitte pwc kpmg unilever nestlé carlsberg spendrups orkla cloetta marabou fazer " +
    "löfbergs zoégas gevalia findus northvolt polestar einride trustly izettle sinch embracer mojang hexagon kinnevik " +
    "alecta fortnox visma hogia sweco afry tyréns ramboll bravida caverion coor sodexo samhall manpower randstad " +
    "adecco lernia hemfrid nordnet avanza collector resurs qliro boozt zalando nelly ellos cervera stadium intersport " +
    "granngården plantagen blomsterlandet mekonomen bilia toyota volkswagen audi bmw mercedes skoda hyundai nissan " +
    "renault peugeot attendo ambea humana aleris capio praktikertjänst apotea lyko boxer comviq halebop hallon vimla " +
    "fello circle-k ingo st1 pressbyrån 7-eleven mcdonalds burger-king sibylla espresso-house wayne's waynes " +
    "clas-ohlson kappahl dressmann gina-tricot bauhaus hornbach dollarstore öob normal mediamarkt netonnet webhallen " +
    "inet komplett dustin atea tieto evry sopra-steria cybercom hiq softronic b3 columbus iver nordlo advania " +
    "swedavia sj mtr arriva nobina keolis vy flixbus sas norwegian ryanair finnair viking-line stena tallink " +
    "scandic nordic-choice elite radisson hilton marriott best-western ikano nordax lendo zmarta compricer " +
    "hemnet booli blocket tradera schibsted-marketplaces eniro hitta ratsit"
  ).split(" "),
);
