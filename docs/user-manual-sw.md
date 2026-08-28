# MRK Hotels — Mwongozo wa Mtumiaji (Kiswahili)

**Toleo 1.3** — v1.1.0 · 15 Agosti 2026

---

## 1. Utangulizi

MRK Hotels ni mfumo wa usimamizi wa hoteli unaoendesha **tovuti ya wageni** (booking portal) na **jopo la wafanyakazi** kwa kila hoteli katika kundi. Kila hoteli inafanya kazi kwa uhuru — ina vyumba vyake, wageni wake, nafasi, malipo, wafanyakazi na shughuli za ofisi — huku **msimamizi mkuu** (superadmin) akisimamia hoteli zote mahali pamoja.

Mfumo unazungumza **Kiswahili** na **Kiingereza**. Tumia kitufe cha **EN / SW** kilicho juu ya kila ukurasa kubadilisha lugha papo hapo.

Mwongozo huu unaeleza jinsi wageni wanavyohifadhi nafasi mtandaoni na jinsi wafanyakazi wa hoteli wanavyoendesha shughuli za kila siku.

---

## 2. Kuanza

### 2.1 Kwenda wapi?

| Eneo | Anwani |
| --- | --- |
| Tovuti ya wageni (ukurasa wa mwanzo) | `http://localhost:5173/` |
| Kuingia kwa wafanyakazi | bofya **Sign in** kwenye tovuti, au fungua `/login` |
| Eneo la msimamizi mkuu | ingia kwa akaunti ya msimamizi mkuu |

### 2.2 Akaunti za majaribio (demo)

Hoteli ya mfano ni **MRK Grand Hotel** (Dodoma, Tanzania). Akaunti zote za majaribio hutumia nenosiri `password`.

| Wajibu | Barua pepe |
| --- | --- |
| Msimamizi wa Hoteli (Hotel Admin) | `admin@mrkhotels.test` |
| Meneja (Manager) | `manager@mrkhotels.test` |
| Mhasibu (Accountant) | `accountant@mrkhotels.test` |
| Mapokezi (Receptionist) | `reception@mrkhotels.test` |
| Afisa Manunuzi (Procurement Officer) | `procurement@mrkhotels.test` |
| Usafi (Housekeeping) | `housekeeping@mrkhotels.test` |
| Jikoni (Kitchen) | `kitchen@mrkhotels.test` |
| Mhudumu (Waiter) | `waiter@mrkhotels.test` |
| Mbarmen (Bartender) | `bartender@mrkhotels.test` |
| Mfanyakazi (Staff) | `staff@mrkhotels.test` |
| Msimamizi Mkuu (Superadmin) | `superadmin@mrkhotels.test` |
| Mmiliki wa Hoteli (hoteli nyingi) | `owner@mrkhotels.test` |

> **Usalama:** Ikiwa mfumo utakwambia nenosiri lako limeisha muda wake, linarudishwa kuwa **jina lako kamili kwa herufi kubwa**. Ingia tena kisha ubadili nenosiri kutoka **Profile**.

### 2.3 Majukumu (roles)

Kila nafasi inaona tu menyu inazohitaji:

| Wajibu | Menyu za kawaida |
| --- | --- |
| Msimamizi wa Hoteli | Kila kitu kwenye jopo la hoteli |
| Meneja | Kila kitu kwenye jopo la hoteli |
| Mhasibu | Nafasi, vyumba, wageni, malipo, orodha ya vitu (inventory), ripoti |
| Mapokezi | Dashibodi, nafasi, vyumba, wageni, malipo, maombi ya nafasi |
| Afisa Manunuzi | Orodha ya vitu, wasambazaji, maombi, maagizo ya ununuzi, kupokea bidhaa |
| Usafi | Usafi (housekeeping), nguo (laundry) |
| Jikoni | Maagizo ya chakula, menyu |
| Mhudumu / Mbarmen / Mfanyakazi | Maagizo ya chakula |
| Msimamizi Mkuu | Hoteli zote, wapangaji (tenants), ripoti za jumla |

> **Ujumbe (Messages)** — sehemu ya 18 — unapatikana kwa kila mfanyakazi, ikijumuisha mazungumzo ya kikundi, **hali (statuses)**, **simu za sauti/video**, majibu (replies), kura (polls), pin/star, kusambaza mbele (forward), template za ujumbe, ujumbe ulioratibiwa, utafutaji, kupeleka nje (export), tafsiri ya EN↔SW, matangazo (announcements), mawasilisho ya zamu (handovers), mazungumzo yaliyounganishwa na chumba, mikutano, SMS kwa mgeni na **taarifa za SOS** — na ukurasa wa **Profaili** (sehemu ya 20) unaonyesha maelezo yote ya akaunti yako.

<figure><img src="images/login.png" alt="Ukurasa wa kuingia"><figcaption>Ukurasa wa kuingia — badilisha kati ya nenosiri na PIN.</figcaption></figure>

### 2.4 Kuingia: nenosiri au PIN

Ukurasa wa kuingia una **njia mbili** — badilisha kwa vifungo vya **Neno la Siri / PIN** juu ya fomu:

- **Neno la Siri** (chaguo-msingi): weka barua pepe na nenosiri lako, kisha bofya **Ingia**.
- **PIN**: kuingia haraka kwa terminali zinazoshirikiwa (mapokezi, baa, jikoni). Andika **jina la mtumiaji au namba yako ya usajili** (mf. `EMP-2026-0004`), kisha bonyeza **PIN yako ya tarakimu 4** kwenye kibodi cha skrini. Unaingizwa moja kwa moja mara tu tarakimu ya nne inapokamilika — hakuna kitufe cha kubofya. Tumia **C** kufuta PIN nzima na **⌫** kufuta tarakimu ya mwisho.

<figure><img src="images/login-pin.png" alt="Ukurasa wa kuingia kwa PIN"><figcaption>Kuingia kwa PIN — andika jina la mtumiaji au namba ya usajili, kisha bonyeza PIN ya tarakimu 4 kwenye kibodi; nukta zinaonyesha maendeleo yako.</figcaption></figure>

> **Huna PIN bado?** PIN huwekwa na msimamizi au meneja wa hoteli kutoka ukurasa wa **Wafanyakazi** (sehemu ya 17) — huwezi kuiweka mwenyewe. Kama huna PIN, endelea kutumia njia ya nenosiri.
>
> Njia zote mbili ni salama vilevile: majaribio mengi yaliyoshindwa hufunga kuingia kwa muda, na PIN iliyokataliwa huanza upya kutoka kibodi tupu.

---

## 3. Tovuti ya Wageni (Public Portal)

Upande wa umma unawawezesha wageni kutafuta hoteli na kuhifadhi nafasi bila kuunda akaunti.

### 3.1 Kutafuta hoteli

1. Fungua ukurasa wa mwanzo (`/`).
2. **Vinjari** orodha, au **chuja kwa Nchi na Mji** kwa kutumia orodha za kuteua — orodha husasishwa yenyewe.
3. Kadi ya kila hoteli inaonyesha idadi ya vyumba vinavyopatikana, aina za vyumba na **bei ya kuanzia kwa usiku mmoja**.
4. Bofya **View Hotel** kuona ukurasa wa hoteli, unaoorodhesha vyumba vyote, bei na uwezo wa wageni.

<figure><img src="images/public-home.png" alt="Ukurasa wa mwanzo wa tovuti ya wageni"><figcaption>Ukurasa wa mwanzo wa tovuti ya wageni — vinjari hoteli, chuja kwa nchi/mji na pakua ankara yako.</figcaption></figure>

### 3.2 Kuhifadhi nafasi

1. Fungua ukurasa wa **Book a Stay** (`/booking`).
2. Chagua **hoteli**, tarehe ya **kufika (check-in)** na **kuondoka (check-out)**, na aina ya nafasi (Single, Couple, Family, Group), kisha bofya **Check availability**.
3. Chagua **vyumba** unavyotaka kwenye matokeo.
4. Jaza **jina, barua pepe, namba ya simu, nchi na mji**.
5. Chagua **tarehe ya kuhifadhi** (inakuwa leo kwa kawaida; haiwezi kuwa baada ya tarehe ya kufika).
6. Angalia **jumla** kisha bofya **Book**.
7. Mfumo unashikilia vyumba vyako kama **pending** na kuonyesha kadi ya malipo.

<figure><img src="images/public-hotel.png" alt="Ukurasa wa hoteli"><figcaption>Ukurasa wa hoteli — vyumba, bei na uwezo wa wageni wa hoteli iliyochaguliwa.</figcaption></figure>

### 3.3 Kulipia nafasi

Malipo yanategemea mbinu ambazo hoteli imewasha:

| Mbinu | Jinsi inavyofanya kazi |
| --- | --- |
| **Selcom** | Inalipa papo hapo — nafasi inathibitishwa mara moja. |
| **Simu ya mkononi** (Airtel Money, Mixx by Yas, HaloPesa, M-Pesa) | Mgeni hulipa kwa simu yake (kielekezo cha ClickPesa). Nafasi inathibitishwa baada ya malipo kuthibitishwa — na webhook ya malipo au na mapokezi wa hoteli. |
| **Uhamisho wa benki** (CRDB, NMB, NBC, Nyingine) | Nafasi inashikiliwa na kuwekwa **awaiting confirmation** hadi hoteli ithibitishe. |

Malipo ya simu yanahitaji **namba ya simu** ya mgeni ili kupokea kielekezo cha malipo.

### 3.4 Maombi ya nafasi (hakuna chumba maalum)

Ikiwa mgeni hakuchagua chumba maalum, ombi linahifadhiwa kama **ombi la nafasi (booking requisition)** — si nafasi kamili. Hoteli inaliona kwenye **Booking Requisitions** na kuwasiliana na mgeni. Hakuna malipo ya mtandaoni kwa hizi.

### 3.5 Kupakua ankara yako

Kwenye ukurasa wa kwanza wa tovuti ya wageni, kadi ya **"Pakua ankara yako"** humruhusu mgeni kupata ankara yake bila kuingia (sign in):

1. Weka **rejea ya uhifadhi** (mf. `BK-2026-0001`).
2. Weka **namba ya simu** uliyotumia kuhifadhi (maandishi yoyote yanafanya kazi — `0712…` au `+255…`).
3. Bonyeza **Pakua ankara** — PDF (iliyopewa jina la namba ya ankara, mf. `INV-2026-0001.pdf`) inapakuliwa kwenye kifaa.

Ankara inaonyesha taarifa za hoteli (nembo, TIN/VRN ikiongezwa), gharama kwa kipengele, mgawanyo wa VAT 18%, malipo yaliyofanywa, salio, maelekezo ya malipo, na sehemu za sahihi. Ikiwa hakuna uhifadhi uliothibitishwa unaolingana na rejea na simu hizo, ujumbe "Hakuna ankara" unaonekana — hakikisha umeandika vyote vivyo.

---

## 4. Jopo la Hoteli — Mambo ya Jumla

Baada ya kuingia, wafanyakazi huwasili kwenye **Dashibodi**. Menyu za juu (au menyu ya simu) zinachujwa kulingana na nafasi.

Vitendo vya kawaida vinavyotumika kila mahali:

- **Refresh** hupakia upya orodha ya sasa.
- **Search** huchuja kwa jina, mgeni au rejea.
- **From / To** hupunguza orodha kwa kipindi cha tarehe.
- **Pagination** chini ya orodha ndefu.

Kwa usalama, kikao (session) kinakutoka nje kiotomatiki baada ya **dakika 5 za kutofanya kazi**, na pia uki**ondoka kwenye ukurasa** (kubadili tabo, kupunguza au kufunga dirisha) — utahitaji kuingia tena.

---

## 5. Dashibodi

Dashibodi inaonyesha hali ya leo kwa mtazamo mmoja:

- Wageni wanaofika na kuondoka leo
- Wageni walio ndani ya hoteli sasa hivi
- Nafasi zinazokuja
- Mapato ya leo na malipo yanayosubiri
- Kiwango cha ukali wa vyumba (occupancy) na hali ya vyumba (available / occupied / cleaning / maintenance)
- Maombi ya nafasi yanayosubiri, vitu vilivyoisha, maagizo ya leo na meza zilizofunguliwa

<figure><img src="images/app.png" alt="Dashibodi ya wafanyakazi"><figcaption>Dashibodi — waoni wanaofika leo, mapato, occupancy na hali ya vyumba kwa mtazamo mmoja.</figcaption></figure>

---

## 6. Nafasi (Reservations)

Ukurasa wa Nafasi ni moyo wa kazi za mapokezi. Unaorodhesha kila nafasi pamoja na mgeni, aina ya nafasi, chumba, tarehe, jumla na salio, na alama ya hali.

### 6.1 Hali (statuses)

| Hali | Maana |
| --- | --- |
| Pending | Imeombwa / imeshikiliwa, bado haijathibitishwa (mf. inasubiri malipo) |
| Confirmed | Malipo yamefika au hoteli imethibitisha |
| Checked in | Mgeni yupo hotelini |
| Checked out | Mgeni ameondoka |
| Cancelled | Nafasi imefutwa |
| No show | Mgeni hakufika |

### 6.2 Kuunda nafasi

1. Bofya **New Reservation**.
2. **Maelezo ya mgeni** — chagua mgeni aliyepo kwenye orodha, au ingiza mgeni anayefika moja kwa moja (walk-in) kwa kujaza jina, simu, barua pepe, nchi, mji na aina/namba ya kitambulisho.
3. **Nafasi** — chagua aina ya nafasi, tarehe ya kuhifadhi, aina ya chumba (hiari), na weka tarehe za kukaa (kufika, kuondoka au idadi ya siku).
4. Bofya **Check Availability** kuona vyumba visivyokuwa na mgeni kwa tarehe hizo, kisha **chagua vyumba**. **Jumla** inakokotolewa kiotomatiki.
5. **Malipo** — weka jumla na kiasi ambacho mgeni **analipa sasa**. Ikiwa analipa sasa, chagua mbinu ya malipo (cash, simu ya mkononi, benki, card), mtoa huduma na rejea ya muamala.
6. Bofya **Save Reservation**. Nafasi inaundwa na kiasi chochote kilicholipwa kinarekodiwa kama malipo.

### 6.3 Kufanya kazi na nafasi

Kwa kila nafasi ya pending au confirmed, safu hutoa:

- **Check in** — inaweka alama ya mgeni kufika.
- **Check out** — inafunga kukaa kwa mgeni aliyefika.
- **No show** — kwa nafasi iliyothibitishwa lakini mgeni hakufika.
- **Cancel** — inafuta nafasi ya pending au confirmed.

<figure><img src="images/app-reservations.png" alt="Ukurasa wa Nafasi"><figcaption>Nafasi — mgeni, chumba, tarehe za kukaa, jumla, salio na hali ya kila nafasi.</figcaption></figure>

---

## 7. Vyumba (Rooms)

Ukurasa wa Vyumba unasimamia vyumba vya hoteli:

- Ona kila chumba pamoja na namba, aina, ghorofa, bei, uwezo na hali ya sasa.
- **Ongeza / badilisha / futa** vyumba.
- **Badilisha hali ya chumba**: available, occupied, cleaning, maintenance.

Aina za vyumba: Single, Double, Suite, Deluxe, Presidential.

<figure><img src="images/app-rooms.png" alt="Ukurasa wa Vyumba"><figcaption>Vyumba — kila chumba kwa namba, aina, ghorofa, bei, uwezo na hali.</figcaption></figure>

---

## 8. Wageni (Guests)

Ukurasa wa Wageni unaweka rejesta ya wageni:

- Tafuta mgeni kwa jina, barua pepe au namba ya simu.
- **Ongeza** mgeni mpya au **badilisha** maelezo.
- Taarifa zinaweka mawasiliano, nchi/mji na kitambulisho.
- Orodha ya wageni pia hulisha orodha ya **existing guest** wakati wa kuunda nafasi.

<figure><img src="images/app-guests.png" alt="Ukurasa wa Wageni"><figcaption>Wageni — rejesta ya wageni wa hoteli pamoja na mawasiliano na kitambulisho.</figcaption></figure>

---

## 9. Malipo (Payments)

Ukurasa wa Malipo unarekodi fedha zote zinazopokewa. Unaweza:

- Kuona kila malipo kwa kiasi, mbinu, mtoa huduma na hali.
- **Rekodi malipo** dhidi ya nafasi.
- Kufuatilia hali: **pending**, **awaiting confirmation**, **completed**, **failed**, **refunded**.

### 9.1 Mbinu na watoa huduma wa malipo

| Mbinu | Watoa huduma |
| --- | --- |
| Cash | — |
| Simu ya mkononi | Airtel Money, Mixx by Yas, HaloPesa, M-Pesa |
| Benki | CRDB, NMB, NBC, Nyingine |
| Selcom | — (inalipa papo hapo) |
| Card | — |

<figure><img src="images/app-payments.png" alt="Ukurasa wa Malipo"><figcaption>Malipo — kiasi, mbinu, mtoa huduma na hali ya kila malipo yaliyopokewa.</figcaption></figure>

---

## 10. Maombi ya Nafasi (Booking Requisitions)

Huu ni mfuko wa **maombi ya nafasi** yaliyofika bila chumba maalum (kutoka tovuti au kwa simu). Kila ombi lina maelezo ya mgeni, aina ya chumba inayotakiwa na tarehe. Hoteli inalikagua na kumjibu mgeni.

> Maombi ya nafasi ni tofauti na nafasi kamili — nafasi inahifadhi chumba halisi; ombi ni mwito wa hoteli kujibu.

<figure><img src="images/app-booking-requisitions.png" alt="Ukurasa wa Maombi ya Nafasi"><figcaption>Maombi ya nafasi — maombi yaliyofika bila chumba maalum.</figcaption></figure>

---

## 11. Usafi (Housekeeping)

Moduli ya Usafi inafuatilia usafi wa vyumba na kazi:

- Ona vyumba vilivyo **chafu**, **vinavyosafishwa** au **viko safi**.
- Unda na ugawie **kazi za usafishaji** kwa wafanyakazi wa usafi.
- Weka alama ya kazi kukamilika ili vyumba virudi kuwa **available**.

<figure><img src="images/app-housekeeping.png" alt="Ukurasa wa Usafi"><figcaption>Usafi — usafi wa vyumba na kazi za usafishaji.</figcaption></figure>

---

## 12. Maagizo na Menyu (Chakula na Vinywaji)

### 12.1 Menyu

Ukurasa wa Menyu (msimamizi/jikoni) unasimamia chakula kinachotolewa:

- Ongeza / badilisha / futa vitu vya menyu kwa jina, bei na kategoria.
- Kategoria na vitu vinaonekana kwenye skrini za maagizo.

### 12.2 Maagizo

Ukurasa wa Maagizo unashughulikia huduma katika mgahawa, baa na chumba:

- Chukua agizo jipya (mhudumu/mbarmen) na vitu, wingi na meza au chumba.
- Fuatilia hali ya agizo: kuandaliwa, kuhudumiwa na kulipwa.
- Jikoni inaona orodha ya maagizo ya kuandaa.

<figure><img src="images/app-menu.png" alt="Ukurasa wa Menyu"><figcaption>Menyu — vitu vinavyotolewa na bei na kategoria zake.</figcaption></figure>

<figure><img src="images/app-orders.png" alt="Ukurasa wa Maagizo ya chakula"><figcaption>Maagizo — huduma katika mgahawa, baa na chumba.</figcaption></figure>

### 12.3 Ubao wa Kuweka Oda (Take Order)

Wahudumu na mabarmen huweka oda za meza kwenye skrini ya **Weka Oda**, iliyoundwa kama POS ya kugusa:

- **Mgahawa / Baa** — gusa mara moja juu kubadilisha ubao mzima: vitufe vya makundi, foleni ya maagizo na aina ya oda vyote vinafuata. Mabarmen huanza kwenye Baa; mtu yeyote anaweza kubadilisha.
- **Vitufe vya makundi** — gusa kundi (Mishkaki, Cocktail, Tambi…) kupopota vitu vyake; gusa kipengele na kinajitokea kwenye tiketi papo hapo.
- **Wageni (covers)** — weka idadi ya watu mezani mara moja unapokaa (kitufe cha − / +). Hakizuizi chochote: kinatumika na tiketi ili ripoti baadaye zikokotoe wastani wa matumizi kwa kila mgeni na idadi ya wageni kwa siku. Mteja wa baa peke yake anaweza kuacha sifuri.
  - Wageni *hawalingani* na maagizo: familia ya watu tano ni tiketi moja na wageni watano; bia ya mtu mmoja ni tiketi moja na mgeni mmoja. Wageni ÷ maagizo = ukubwa wa kawaida wa kikundi — ukitazama mabadiliko yake utagundua meza zinapokuwa tupu hata mapato yakionekana sawa.
- **Aina ya oda** inachaguliwa kwako: oda za mgahawa ni Dine-in, za baa ni At-bar kiotomatiki; oda za huduma ya chumba kutoka ukurasa wa Maagizo zinasalia Hotel-menu.
- **Inaambatana na** — vyakula vya kuchoma mgahawani (mishkaki, nyama choma…) vinauliza kiarabu cha kukamilisha (wali, ugali, chips…). Chaguo linaonekana kwenye tiketi ya jikoni na kuhifadhiwa kwenye historia ya oda.

### 12.4 Ubao wa Jikoni (gusa moja)

Wafanyakazi wa jikoni wanatua kwenye **Ubao wa Jikoni** wenye rangi nyeusi: kadi moja kwa kila tiketi wazi inayoonyesha namba ya oda, meza/chumba, idara na dakika zilizopita. Kila sahani kwenye kadi **yenyewe ni kitufe** — gusa mara moja ikiwa tayari, na mbeba anagusa tena ikifika kwa mgeni. Hakuna madirira madogo, hakuna vichujio; ubao unajiondoa yenyewe kila sekunde 15 ili tiketi mpya zijitokee peke zake, na "Inaambatana na" vinaonekana chini ya vyakula vyao. Malipo yanabaki hatua tofauti ya meneja/mkadiriaji.

---

## 13. Nguo (Laundry)

Moduli ya Nguo inasimamia nguo za wageni na za hoteli:

- Rekodi agizo la nguo (mgeni, vitu, wingi, bei).
- Fuatilia hali: received, washing, drying, ironing, completed, delivered.
- Kila agizo lina namba ya kufuatilia (laundry number).

<figure><img src="images/app-laundry.png" alt="Ukurasa wa Nguo"><figcaption>Nguo — maagizo ya nguo za wageni na hoteli na maendeleo yake.</figcaption></figure>

---

## 14. Michezo na Burudani (Fun and Games)

Moduli hii inasimamia shughuli za burudani zinazolipishwa:

- Ongeza maagizo ya michezo au shughuli.
- Rekodi mgeni, kitu/shughuli na bei, kwa namba ya kufuatilia.

<figure><img src="images/app-fun-games.png" alt="Ukurasa wa Michezo na Burudani"><figcaption>Michezo na Burudani — shughuli na michezo inayolipishwa.</figcaption></figure>

---

## 15. Orodha ya Vitu na Wasambazaji (Inventory na Suppliers)

### 15.1 Orodha ya vitu

- Dumisha orodha: jina la kitu, kitengo, kiasi, kiwango cha kuagiza tena na gharama.
- Dashibodi inaonya kuhusu vitu **vilivyoisha**.
- Orodha inasasishwa kiotomatiki wakati bidhaa zinapokelewa, na mienendo ya stoo inarekodiwa.

<figure><img src="images/app-inventory.png" alt="Ukurasa wa Orodha ya Vitu"><figcaption>Orodha ya vitu — stoo, kiasi, viwango vya kuagiza tena na gharama.</figcaption></figure>

### 15.2 Wasambazaji

- Dumisha rejesta ya wasambazaji: jina, mtu wa mawasiliano, simu, barua pepe, anwani.
- Wasambazaji wanaunganishwa na maagizo ya ununuzi.

<figure><img src="images/app-suppliers.png" alt="Ukurasa wa Wasambazaji"><figcaption>Wasambazaji — rejesta ya wasambazaji wanaounganishwa na maagizo ya ununuzi.</figcaption></figure>

---

## 16. Manunuzi (Procurement)

### 16.1 Maombi (Requisitions)

- Mfanyakazi anaomba vitu (kiasi, tarehe ya kuhitajika, maelezo).
- Maombi hukaguliwa na kubadilishwa kuwa maagizo ya ununuzi.

<figure><img src="images/app-requisitions.png" alt="Ukurasa wa Maombi ya Ununuzi"><figcaption>Maombi ya ununuzi — maombi ya wafanyakazi ya vitu vinavyoagizwa.</figcaption></figure>

### 16.2 Maagizo ya Ununuzi (Purchase Orders)

- Unda agizo la ununuzi kutoka ombi au moja kwa moja.
- Chagua **msambazaji**, ongeza vitu kwa wingi na bei, na rekodi tarehe ya kufika.
- Fuatilia hali: pending, approved, ordered, received, cancelled.

<figure><img src="images/app-purchase-orders.png" alt="Ukurasa wa Maagizo ya Ununuzi"><figcaption>Maagizo ya ununuzi — maagizo kwa msambazaji pamoja na vitu, wingi na tarehe za kufika.</figcaption></figure>

### 16.3 Kupokea Bidhaa (Goods Received)

- Bidhaa zikifika, rekodi **notisi ya kupokea (GRN)** dhidi ya agizo.
- Kiasi kinachopokelewa **kinasasisha orodha ya vitu kiotomatiki**.
- Tofauti yoyote kati ya kiasi kilichoagizwa na kilichopokelewa inanakiliwa kwenye GRN.

<figure><img src="images/app-goods-received.png" alt="Ukurasa wa Kupokea Bidhaa"><figcaption>Kupokea Bidhaa — notisi za kupokea dhidi ya maagizo; kiasi kinasasisha stoo kiotomatiki.</figcaption></figure>

---

## 17. Wafanyakazi (Staff)

Ukurasa wa Wafanyakazi (msimamizi/meneja) unasimamia timu:

- Ongeza mfanyakazi kwa nafasi yake (manager, accountant, receptionist, housekeeping, kitchen, waiter, bartender, staff, …).
- Kila mfanyakazi anapata **namba ya usajili** (mf. `EMP-2026-0004`) — huitumia pia kama kitambulisho cha kuingia kwa PIN (sehemu ya 2.4).
- **Washa / zima** akaunti, **weka upya nenosiri**, na **waalike** wafanyakazi kuingia.
- **Weka PIN ya kuingia ya tarakimu 4** kutoka kwenye mstari wa mfanyakazi (**Weka PIN**) ili atumie njia ya PIN kwenye terminali zinazoshirikiwa. Kisanduku **kinatengeneza PIN salama bila mpangilio kiotomatiki** — bonyeza kitufe cha kubadilisha (refresh) kutengeneza nyingine, kitufe cha nakili (copy) kuinakili, na kishirikishe na mfanyakazi. Badilisha kuwa **Niandike mwenyewe** ikiwa unapendelea kuweka PIN unayochagua (mashamba yote mawili yana kitufe cha jicho kuonyesha/ficha). PIN huhifadhiwa kwa usalama na inaweza kubadilishwa wakati wowote. Unaweza kuweka PIN tu kwa nafasi zilizo sawa au chini ya yako — na sio yako mwenyewe.
- Rekodi kitambulisho/viambatisho kwa kila mwanachama.

<figure><img src="images/app-staff.png" alt="Ukurasa wa Wafanyakazi"><figcaption>Wafanyakazi — simamia timu, nafasi, akaunti, mialiko, kuweka upya nenosiri na PIN za kuingia.</figcaption></figure>

<figure><img src="images/app-staff-set-pin.png" alt="Kisanduku cha Weka PIN ya Kuingia"><figcaption>Weka PIN ya Kuingia — PIN inatengenezwa kiotomatiki kwa ajili ya kushirikisha; au badilisha na uandike mwenyewe. PIN huhifadhiwa kwa usalama na inaweza kubadilishwa wakati wowote.</figcaption></figure>

---

## 18. Ujumbe (Messages)

Ujumbe ni kikasha cha wafanyakazi. Kila mfanyakazi anaweza kuzungumza na mwenzake mmoja-mmoja na kushiriki katika mazungumzo ya kikundi, ndani ya hoteli au kwenye mtandao mzima wa MRK Hotels. Zaidi ya ujumbe wa kawaida, inatoa pia majibu yenye nukuu, kipaumbele cha dharura na kura, pin na star, kusambaza mbele, template zinazoweza kutumika tena, ujumbe ulioratibiwa, utafutaji, kupeleka nje kwa CSV, tafsiri ya Kiingereza↔Kiswahili, matangazo, mawasilisho ya zamu, mazungumzo ya kazi yaliyounganishwa na chumba, mikutano, SMS kwa wageni na taarifa za SOS kwa kubofya moja — vyote vinapatikana kwenye paneli ya **Workspace** na menyu za viputo vya ujumbe.

### 18.1 Mazungumzo

- **New Message** huanzisha mazungumzo. Chagua wigo kwanza:
  - **Hotel Confidential** — wafanyakazi wa hoteli yako tu.
  - **Global Messaging** — mfanyakazi yeyote kwenye mfumo, hoteli zote.
- Tafuta mwenzako kwa jina kisha umchague — mazungumzo hufunguka mara moja.
- Ujumbe ambao haujasomwa huonyesha alama ya bluu kwenye mazungumzo na kwenye menyu ya Ujumbe.
- **Nukta ya kijani** karibu na picha ya mwenzako (orodha ya mazungumzo, kichwa cha mazungumzo, wanachama wa kikundi, matokeo ya utafutaji) inamaanisha mwenzako ameunganishwa sasa hivi — ndani ya hoteli yako au mahali popote kwenye mtandao; wale ambao hawako mtandaoni hawana nukta.

### 18.2 Mazungumzo ya kikundi

- **New Group** huunda kikundi cha timu: taja kikundi, chagua angalau mwenzako mmoja, kisha kiunde.
- **Muundaji** anaweza kuongeza au kumuondoa mwanachama; mwanachama yeyote anaweza **kuondoka** kwenye kikundi.
- Ujumbe wa kikundi huhesabiwa kama umesomwa mara tu unapoonekana na angalau mwanachama mmoja.

### 18.3 Alama za kufikisha na kusoma

Baada ya kutuma ujumbe, alama inaonyesha hali yake:

| Alama | Maana |
| --- | --- |
| ✓ (moja) | Imetumwa na kufikishwa kwenye kifaa kingine |
| ✓✓ (mbili) | Imesomwa — mpokeaji amefungua mazungumzo |
| ✓✓ (iliyojazwa) | Imeonekana na wanachama wengine wa kikundi ("Seen by N") |

> Ujumbe huwa **umefikishwa** (delivered) mara tu kifaa cha mpokeaji kikichota ujumbe — hata kabla ya kufunguliwa. Huwa **umesomwa** (read) mpokeaji anapofungua mazungumzo.

### 18.4 Ujumbe wa sauti, viambatisho na view-once

- Bonyeza **kipaza sauti** na uzungumze — ujumbe wa sauti hutumwa mara tu unaposimama, na unachezwa ndani ya mazungumzo.
- Tumia **karatasi ya kuambatisha** kutumia picha au faili yoyote.
- Kutuma picha au video ya **view-once**, washa alama ya jicho kwenye kidude cha kuandikia kabla ya kutuma. Mpokeaji anaweza kuifungua **mara moja tu**; baada ya hapo inaonyesha "imefunguliwa" na haiwezi kuchezwa tena.

### 18.5 Kufuta ujumbe na majibu (reactions)

- **Futa ujumbe**: elekeza kipanya juu ya ujumbe (desktopi) au ushikilie kwa muda mrefu (simu) kisha chagua **Delete**.
  - **For me** — wewe tu ndiye huwezi kuuona tena; mwenzako bado anauona.
  - **For everyone** — ujumbe huondoka kwa kila mtu kwenye mazungumzo.
- **Jibu ujumbe kwa emoji**: elekeza/sikililie ujumbe kisha chague emoji. Jibu linaonekana chini ya ujumbe; gusa jibu lako mwenyewe kuliondoa. Majibu yanaonekana kwa kila mtu kwa wakati halisi.

### 18.6 Kutaja mwenzako (mentions)

- Andika **@** kwenye kidude cha kuandikia ili kuona orodha ya wafanyakazi, kisha mchague mtu. Jina lake linaangaziwa kwenye ujumbe, na anapokea taarifa kwamba ametajwa.

### 18.7 Hali (Statuses)

- Chapisha **hali** (maandishi, picha au video) kutoka ukurasa wa **Statuses**. Inaonekana kwa wafanyakazi wenzako kwa muda wa **masaa 24**, kisha huondoka kiotomatiki.
- Tazama hali kutoka ukurasa wa Statuses — wafanyakazi wenye hali amilifu pia huonyesha **pete ya rangi** kuzunguka avatar yao kwenye orodha ya mazungumzo.
- Unaweza **kujibu** hali kwa emoji na kuona nani ameiangalia.

### 18.8 Simu za sauti na video

- Fungua mazungumzo kisha gusa ikoni ya **simu** (sauti) au **video** kumpigia mwenzako.
- Yeye huona skrini ya simu inayoingia na anaweza **Accept** (kukubali) au **Decline** (kukataa). Mwenzako aliye na shughuli anaweza pia kukataa, ikionyesha simu imekataliwa.
- Simu inaunganisha moja kwa moja (hakuna seva ya media katikati) na inaisha upande wowote unaposimamisha. Simu ambazo hazijapokelewa zinaonekana kwenye **historia yako ya simu**.

<figure><img src="images/app-messages.png" alt="Ukurasa wa Ujumbe"><figcaption>Ujumbe — mazungumzo yenye kura ya dharura, nukuu ya jibu na ujumbe uliopigwa pin.</figcaption></figure>

### 18.9 Majibu, kipaumbele na kura

- **Jibu ujumbe**: elekeza/sikililie ujumbe kisha uchague **Reply** (au gusa ikoni ya kujibu kwenye menyu ya ujumbe). Kidude cha kujibu kinaonekana kwenye eneo la kuandikia; ujumbe wako hutumwa kama jibu na ujumbe wa asili unanukuliwa juu yake. Mtu yeyote anaweza kugusa nukuu kuruka kwenye ujumbe wa asili.
- **Weka ujumbe kuwa wa dharura**: washa swichi ya **kipaumbele** kwenye kidude cha kuandikia kabla ya kutuma. Ujumbe wa dharura huonyesha ukingo mwekundu, lebo ya "urgent", unapigwa pin kiotomatiki na hupelekwa kwa wasimamizi kama hakuna anayeusoma kwa wakati.
- **Tuma kura**: fungua kidude cha kura kwenye eneo la kuandikia, andika swali na chaguo angalau mbili, na uamue kama wafanyakazi wanaweza kuchagua zaidi ya moja. Kura inaonekana ndani ya mazungumzo pamoja na hesabu za kura kwa wakati halisi — gusa chaguo kupiga kura (mara moja). Kura zinaonekana kwa kila mtu kwa wakati halisi.

### 18.10 Kupiga pin na star

- **Piga pin ujumbe** ili ubaki juu ya mazungumzo kwa kila mtu (k.m. ratiba ya zamu au orodha ya vyumba). Chagua **Pin** kwenye menyu ya ujumbe; ondoa pin kutoka kwenye paneli ya pinned.
- **Piga star ujumbe** kuuhifadhi kwenye orodha yako binafsi (kama alama — mtu mwingine haoni). Fungua **Starred** kwenye paneli ya Workspace kuruka kwenye ujumbe wowote ulio star.

### 18.11 Kusambaza mbele, template na ujumbe ulioratibiwa

- **Sambaza ujumbe mbele** kwa mwenzako au kikundi: chagua **Forward** kwenye menyu ya ujumbe, chagua mazungumzo lengwa, kisha tuma. Nakala ina lebo ya "Forwarded" ili kila mtu ajue imetoka mahali pengine.
- **Hifadhi template**: chagua **Save as template** kwenye menyu ya ujumbe kuhifadhi ujumbe unaotumika mara kwa mara. Kichagua template kwenye eneo la kuandikia kinakibandika kwa kubofya moja.
- **Ratibu ujumbe**: fungua kidude cha ratiba kwenye eneo la kuandikia, chagua tarehe na saa, kisha tuma. Ujumbe hufikishwa kiotomatiki wakati huo. Simamia ujumbe uliosubiri kwenye **Workspace → Scheduled** na ughairi pale.

<figure><img src="images/app-messages-composer.png" alt="Zana za kidude cha kuandikia"><figcaption>Zana za kidude cha kuandikia — kijenzi cha kura, kidude cha ratiba na kichagua template.</figcaption></figure>

### 18.12 Utafutaji, kupeleka nje na tafsiri

- **Tafuta ujumbe**: tumia kidirisha cha utafutaji kwenye kichwa cha mazungumzo kutafuta ndani ya mazungumzo ya sasa. Tumia **Workspace → Search** kwa utafutaji mpana katika mazungumzo yote.
- **Peleka mazungumzo nje**: tumia kitufe cha kupeleka nje (download) kwenye kichwa cha mazungumzo kushusha mazungumzo yote kama faili ya CSV, tayari kwa Excel.
- **Tafsiri ujumbe**: ujumbe wa mwenzako unaweza kutafsiriwa kati ya Kiingereza na Kiswahili kwa kitufe cha tafsiri kwenye menyu ya ujumbe — viputo hubadilisha kati ya asili na tafsiri (hufanya kazi nje ya mtandao).

### 18.13 Matangazo na upelekwaji kwa wasimamizi (escalation)

- **Matangazo**: wasimamizi huweka matangazo ya hoteli nzima yanayoonekana kwenye **Workspace → Announcements**. Gusa **Acknowledge** ili mtumaji aone nani ameyasoma.
- **Peleka ujumbe kwa wasimamizi**: kama ujumbe unahitaji uangalizi wa usimamizi, chagua **Escalate** kwenye menyu ya ujumbe. Unaonekana kwenye kichupo cha Escalations, ambapo meneja anaweza kuweka alama ya **Resolved**.

<figure><img src="images/app-messages-workspace.png" alt="Paneli ya Workspace"><figcaption>Paneli ya Workspace — matangazo, mikutano, handovers, SMS za wageni, wa karibu, escalations, SOS, scheduled, starred na retention.</figcaption></figure>

### 18.14 Kutuliza (mute), Do-Not-Disturb na uhifadhi (retention)

- **Tuliza mazungumzo**: tumia ikoni ya kipaza sauti kwenye kichwa cha mazungumzo (au **Mute** kwenye menyu ya mazungumzo) kutuliza mazungumzo — kwa hiari hadi tarehe uliyochagua. Mazungumzo yaliyotulizwa huonyesha ikoni ya kipaza sauti kilichovuka.
- **Do Not Disturb**: weka dirisha la kila siku la kutopokea taarifa kwenye workspace ili usitaarifiwe wakati wa saa zako za mapumziko.
- **Uhifadhi (wasimamizi)**: kichupo cha Retention kinawaruhusu wasimamizi wa hoteli kuweka siku ngapi historia ya mazungumzo ihifadhiwe. Ujumbe wenye umri mkubwa kuliko sera husafishwa kiotomatiki.

### 18.15 Mawasilisho ya zamu na mazungumzo yaliyounganishwa na chumba

- **Mawasilisho ya zamu**: mwishoni mwa zamu, weka muhtasari (maelezo + nyakati) kutoka **Workspace → Handovers**. Zamu inayofuata inathibitisha, na hoteli nzima inaona imepokelewa.
- **Unganisha mazungumzo na chumba**: tumia ikoni ya chumba kwenye kichwa cha mazungumzo kuunganisha mazungumzo na chumba cha hoteli (k.m. housekeeping kwa Chumba 401). Mazungumzo yaliyounganishwa na chumba yanaweza kuwa **vikundi vya kazi (task groups)**, na ujumbe wowote ndani yake unaweza **kubadilishwa kuwa kazi ya housekeeping** — kwa hivyo "Chumba 401 kinahitaji shuka" inakuwa kazi halisi.

### 18.16 Wafanyakazi wa karibu na SMS kwa wageni

- **Wafanyakazi wa karibu**: sasisha eneo/sakafu yako kwenye **Workspace → Nearby**, na uone wafanyakazi walio karibu (ndani ya dakika 30 zilizopita). Eneo lako linasasishwa kwa timu yako kwa wakati halisi.
- **SMS kwa mgeni**: kutoka **Workspace → Guest SMS**, tuma ujumbe kwa simu ya mgeni (k.m. "chumba chako kiko tayari") — huu ni mwelekeo mmoja (hoteli → mgeni): wageni hawawezi kujibu kwa ujumbe mfupi, wanapiga simu kwa usaidizi badala yake. Ujumbe wote uliotumwa na historia zinabaki kwenye hoteli.

### 18.17 Mikutano na taarifa za SOS

- **Mikutano**: ratibu mkutano (kichwa, muda wa kuanza, muda wa kudumu, aina) na uwaalike wafanyakazi kutoka **Workspace → Meetings**. Waalikwa wanapata mwaliko wa moja kwa moja na wanaweza kukubali au kukataa; mratibu anaona majibu yakisasishwa papo hapo.
- **Taarifa za SOS**: kitufe chekundu cha **SOS** huelea juu ya orodha ya mazungumzo. Bonyeza katika dharura — kila mfanyakazi wa hoteli anataarifiwa mara moja, anaweza **Acknowledge** (ili kila mtu ajue msaada unakuja) na meneja anaweza kuweka alama ya **Resolved**.

<figure><img src="images/app-statuses.png" alt="Ukurasa wa Hali"><figcaption>Hali (Statuses) — chapisha hali ya maandishi, picha au video ya masaa 24 kwa wafanyakazi wenzako.</figcaption></figure>

---

<figure><img src="images/app-messages-meetings.png" alt="Mikutano"><figcaption>Mikutano — ratibu mkutano na uwaalike wafanyakazi.</figcaption></figure>

<figure><img src="images/app-messages-sos.png" alt="Taarifa za SOS"><figcaption>Taarifa za SOS — anzisha, thibitisha na suluhisha dharura.</figcaption></figure>

## 19. Ripoti na Muhtasari

### 19.1 Muhtasari (Overview — msimamizi/meneja)

Muhtasari wa hali ya juu wa utendaji wa hoteli. Kila sehemu inaweza kutafutwa na kuchujwa, na ina **pagination** yake (rekodi 15 kwa ukurasa):

- **Wafanyakazi** — tafuta kwa jina, barua pepe au namba ya usajili; chuja kwa **wajibu** na **hali ya akaunti**.
- **Wageni waliomo hotelini** — tafuta kwa jina, simu au namba ya chumba.
- **Wageni wanaotarajiwa kufika** — tafuta kwa jina.
- **Foleni ya usafi** — chuja kwa hali ya kazi.

Chini ya kila sehemu unaweza kuruka kati ya kurasa. Kadi za muhtasari juu ya sehemu hizo huakisi hoteli nzima kila wakati.

<figure><img src="images/app-overview.png" alt="Ukurasa wa Muhtasari"><figcaption>Muhtasari — wafanyakazi, wageni walio hotelini, wageni wanaotarajiwa na foleni ya usafi.</figcaption></figure>

### 19.2 Ripoti (msimamizi/meneja/mhasibu)

- **Occupancy** — kiwango cha ukali wa vyumba kwa tarehe.
- **Revenue** — mapato kwa kipindi.
- **Room status** — hali ya sasa ya kila chumba.
- **Audit logs** — nani alifanya nini na lini (msimamizi/meneja).

<figure><img src="images/app-reports.png" alt="Ukurasa wa Ripoti"><figcaption>Ripoti — occupancy, mapato, hali ya vyumba na kumbukumbu za vitendo (audit logs).</figcaption></figure>

---

## 20. Profaili na Nenosiri

- **Profile** inaonyesha maelezo yote ya akaunti yako: jina, namba ya mfanyakazi/usajili, barua pepe, simu, namba ya nchi, wajibu na kiwango chake, idara, cheo, aina na namba ya kitambulisho, hoteli yako, hali ya msimamizi mdogo, hali ya akaunti, mara ya mwisho kuingia na tarehe ya kujiunga.
- **Ingia / toka zamu** kutoka kwenye kadi ya mahudhurio (attendance) na uone umekaa zamu kwa muda gani. Ikiwa hoteli yako imewasha ukaguzi wa eneo, au QR, au uthibitisho wa picha (selfie), kadi ya mahudhurio itauliza nafasi ya simu yako, inaweza kukuhitaji kumpa ruhusa ya kamera na kupakia selfie, na, pale inapohitajika, kuchanganua QR ya ofisi (inayoonyeshwa kwenye simu ya meneja, inayoburudishwa kila dakika) kabla zamu kuanza — hili linathibitisha uwepo kazini. Kadi pia inaonyesha alama zozote za mashaka (suspicious) au adhabu zilizotokana na ukaguzi wa ulaghai (anti-cheat), ambazo meneja huzipitia.
- **Badilisha nenosiri** kutoka profaili; chagua nenosiri imara na ulinde vizuri.
- Ikiwa msimamizi wa hoteli ameweka upya nenosiri lako, ingia kwa la muda kisha ulibadilishe mara moja.

<figure><img src="images/app-profile.png" alt="Ukurasa wa Profaili"><figcaption>Profaili — maelezo ya akaunti, kadi ya mahudhurio na kubadilisha nenosiri.</figcaption></figure>

---

## 21. Mantiki ya Biashara na Mzunguko wa Maisha (Lifecycles)

Kila rekodi katika MRK Hotels husonga kupitia hali zilizowekwa. Kila mzunguko hapa chini unaonyesha hatua zinazoruhusiwa za kusonga mbele na watu wanaoweza kuzifanya. Rekodi husonga **mbele tu** — kuruka kinyume cha sheria hukataliwa kwa hitilafu.

**Mfumo mzima kama kitanzi kimoja** — tangu mgeni ahifadhi nafasi hadi chumba kiwe tayari kwa mgeni mwingine:

```
  ① MGENI ANAHIFADHI NAFASI
     Tovuti ya wageni, kwa simu au mapokezi.
     • Amechagua chumba   → nafasi ya RESERVATION (pending) inaundwa.
     • Hakuchagua chumba  → OMBÌ LA NAFASI (requisition) linaundwa; hoteli inajibu.
        │
        ▼
  ② PESA ZINASOGEA
     pending → completed  (au zinashikiliwa kama awaiting confirmation)
     • Selcom inalipa papo hapo.
     • Simu ya mkononi inathibitishwa na mapokezi — webhook ya malipo
       mtandaoni pia inaweza kuiweka completed kiotomatiki.
     • Uhamisho wa benki unathibitishwa na hoteli.
     Pesa zikimalizika, nafasi inakuwa CONFIRMED.
        │
        ▼
  ③ MGENI ANAFIKA
     Mkazi (resident): check-in → nafasi inakuwa CHECKED IN,
     chumba OCCUPIED, mgeni IN HOUSE.
     Mgeni asiye na chumba: mgeni wa walk-in ambaye HANA chumba — anakuja
     kwa huduma tu (mgahawa, baa, michezo, nguo).
        │
        ▼
  ④ KUKAA — AU — KUTUMIA HUDUMA
     Mkazi: maagizo ya chakula, nguo, michezo na gharama za ziada
     zinatolewa kwenye chumba na kuongezwa kwenye salio la nafasi.
     Mgeni asiye na chumba: huduma zile zile zinapatikana bila chumba —
     hulipa papo hapo moja kwa moja.
        │
        ▼
  ⑤ MGENI ANAONDOKA
     Mkazi: check-out inasuluhisha salio lolote (malipo ya mwisho
     yanarekodiwa) na nafasi inakuwa CHECKED OUT.
     Mgeni asiye na chumba: ziara inaisha tu.
        │
        ▼
  ⑥ USAFISHAJI (kwa wakazi tu)
     Check-out huweka kazi ya usafishaji kiotomatiki:
     dirty → cleaning → verified → chumba kisafi.
        │
        ▼
  ⑦ CHUMBA KIKO TAYARI
     Chumba kinarudi kuwa AVAILABLE kwa mgeni mwingine.
        │
        ▼
   ───────────────────────────────────────────────
   KITANZI KINARUDIA: mgeni mpya anahifadhi → kurudi ①
```

Vitanzi vitatu vya **kusaidia** vinaendesha kitanzi kikuu:

```
  USAFIRI WA BIDHAA (SUPPLY) — huweka hoteli na vitu
     Ombì → Meneja anaidhinisha → Agizo la ununuzi → Fedha zinaidhinisha
        → Kupokea bidhaa (GRN) → stoo inasasishwa
        → jikoni / usafi vinatumia stoo → onyo la vitu vilivyopungua → ombì jipya

  WATU (PEOPLE) — timu nyuma ya kila hatua
   Mahudhurio:  clock in (ukaguzi wa eneo wa ofisi unapowekwa/ukiwashwa; + QR kama imewashwa) → zamu → clock out
     Matatizo:    new → in progress → resolved
     Ujumbe:      sent → delivered → read
     Dharura:     sent → (hajasoma) → auto-escalated → resolved
     SOS:         initiated → acknowledged → resolved
     Mkutano:     scheduled → invited → accepted / declined
     Handover:    posted → acknowledged

  MUUNDO WA TIMU (ORGANIZATION) — msimamizi anajenga timu; kila wadhifa anamtumikia mteja
     Msimamizi anamuongeza mwanachama → anapanga nafasi, idara na wadhifa
      → nambari ya usajili inatolewa (EMP-2026-0004)
      → akaunti inawezeshwa → PIN ya kuingia (nambari 4) inaweza kuwekwa kama hatua ya hiari na msimamizi; mwanachama anaweza kuingia kwa kutumia nenosiri au PIN
     Msururu wa huduma — kila wadhifa anahusiana moja kwa moja na mteja:
        Mapokezi (Receptionist) — kuhifadhi nafasi, check-in/out kwa wageni,
                        kujibu ombì za nafasi, kurekodi malipo ya mapokezi,
                        kuweka daftari la wageni
        Waiter / Bartender / Staff — kuchukua maagizo ya chakula na kuhudumia
                        mgahawa, baa na room service, kurekodi michezo na
                        nguo pale mahali pa huduma
        Jiko (Kitchen)   — huandaa kila agizo linalotoka sakafuni
        Usafi (Housekeeping) — dirty → cleaning → verified → clean; nguo za
                        wageni: received → washing → drying → ironing → delivered
        Mhasibu (Accountant) — hurekodi na kuthibitisha malipo, hulinganisha daftari
        Manunuzi (Procurement) — ombì → meneja anaidhinisha → agizo la ununuzi
                        → fedha zinaidhinisha → bidhaa zinapokelewa → stoo inasasishwa
     MENEJA anasimamia timu na kuidhinisha rekodi zinazohitaji idhini.
     MSIMAMIZI anaiweka timu imara: kuweka upya nenosiri / kuweka PIN mpya
        wakati wowote, kualika na kuwezesha tena kadri inavyohitajika, kuzima
        akaunti mwanachama anapoondoka → mwanachama mpya anajiunga → kurudi mwanzo
```

### 21.1 Kuhifadhi nafasi mtandaoni na malipo

```
Requested → Pending → Confirmed → Checked in → Checked out
                ↕          ↘ No show
           Malipo yameshikiliwa    ↘ Cancelled
```

- Nafasi huanza kama **pending**. Kulingana na mbinu ya malipo:
  - **Selcom** inalipa papo hapo → inakuwa **confirmed** mara moja.
  - **Simu ya mkononi** inabaki pending hadi ithibitishwe — na webhook ya malipo au na mapokezi.
  - **Uhamisho wa benki** unashikiliwa kama **awaiting confirmation** hadi hoteli iithibitishe.
- Nafasi iliyothibitishwa inawekwa alama ya **checked in** mgeni anapofika na **checked out** anapoondoka. Inaweza kuwekwa alama ya **no show** au **cancelled**.

### 21.2 Ombì la nafasi (hakuna chumba maalum)

```
Pending → Reviewing → Quoted → Confirmed
                 ↘ Rejected → Cancelled
```

Hoteli inalikagua ombi, inaweza kutuma **quote** (bei), na kuthibitisha kukaa. Mgeni anaweza kufuatilia ombi mtandaoni kwa kutumia rejea yake. Hakuna malipo ya mtandaoni kwa maombi.

### 21.3 Mzunguko wa hali ya nafasi

```
Pending → Confirmed → Checked in → Checked out
    ↘ Cancelled          ↘ No show
```

Wafanyakazi wa mapokezi ndio wanaoweka alama ya kufika na kuondoka. **Check-out** huanza kwa kusuluhisha salio lolote (tazama 21.4) na kuweka kazi ya usafishaji kwa chumba.

### 21.4 Mzunguko wa hali ya malipo

```
Pending → Awaiting confirmation → Completed → Refunded
    ↘ Failed
```

- Malipo ya **completed** yamesuluhishwa; malipo yaliyokamilika yanaweza **kurudishwa (refunded)**.
- **Simu ya mkononi** (mtandaoni au mezani) inathibitishwa na **mapokezi** kwa kutumia rejea kutoka SMS ya mgeni. Malipo ya mtandaoni pia yanaweza kukamilishwa kiotomatiki na webhook ya malipo.
- **Uhamisho wa benki** unasubiri katika **awaiting confirmation** hadi hoteli iithibitishe amana.
- Malipo yaliyoshindikana yanabaki **failed** na hayahesabiwi kama mapato.

### 21.5 Mzunguko wa agizo la chakula (F&B)

```
Pending → In progress/Processing/Preparing → Ready → Served → Completed
    ↘ Cancelled
```

- Jikoni inaandaa agizo, inaweka alama ya vitu **ready** (vikoleo), na wahudumu wanavipa alama **served**.
- Malipo: **Unpaid → Paid**, au **billed to room** wakati mgeni aliyemo hotelini anatozwa kwenye kukaa kwake. Agizo lililotozwa linawekwa completed.

### 21.6 Mzunguko wa kazi ya usafi

```
Dirty → In progress → Confirmed → Verified → Completed
```

- Kazi inaundwa kama **dirty** (check-out huiweka kiotomatiki). Mfanyakazi **anaianza**, msimamizi **anathibitisha**, mtu **anaihakiki (verify)**, kisha **inakamilika**.
- Chumba kiwe safi kinaporejeshwa kuwa **available**.
- Mzunguko wa chumba: Dirty → Cleaning → Clean / Available.

### 21.7 Mzunguko wa agizo la nguo (Laundry)

```
Pending → Ready → Delivered
    ↘ Cancelled
```

Kila agizo lina namba ya kufuatilia. Maagizo huenda kutoka pending kwenda ready baada ya kuoshwa/kufuliwa, kisha delivered kwa mgeni.

### 21.8 Mzunguko wa manunuzi

```
Ombì:        Pending → Approved → Purchase order      (Rejected / Cancelled)
Agizo la ununuzi: Pending → Manager approved → Finance approved → Received / Partially received
                    ↘ Cancelled
Kupokea bidhaa: GRN inarekodi kilichofika → orodha ya vitu inasasishwa kiotomatiki
```

- Idara inaweka **ombi (requisition)**; **meneja** analiidhinisha.
- Ombì lililoidhinishwa linakuwa **agizo la ununuzi (PO)**. **Meneja** analiidhinisha kwanza, kisha **fedha (finance)**.
- Bidhaa zikifika, **notisi ya kupokea (GRN)** inarekodi kilichopokelewa (na kilichokataliwa); orodha ya vitu inasasishwa kiotomatiki.

### 21.9 Mzunguko wa ripoti ya tatizo

```
New → In progress → Resolved
  ↘ Cancelled
```

Mfanyakazi yeyote anaweza kuweka ripoti; meneja anaiendea (**in progress**), anaifanyia kazi, na **kuitatua (resolved)**. Maoni yanaweka ufuatiliaji. Ripoti zinaweza kufutwa (cancelled) zikiwa new au in progress.

### 21.10 Mzunguko wa ujumbe

```
Sent → Delivered → Read
```

- **Delivered** wakati kifaa cha mpokeaji kimechota ujumbe.
- **Read** mpokeaji anapofungua mazungumzo (vikundi: umeonekana na angalau mwanachama mmoja).
- Alama kwenye ujumbe zinaonyesha hali ya sasa (tazama 18.3).

---

## 22. Jopo la Msimamizi Mkuu (Superadmin)

Msimamizi mkuu anaona mpangilio tofauti (upande wa giza):

- **Dashboard** — muhtasari wa mfumo mzima.
- **Tenants** — kila hoteli katika mfumo:
  - Idhini hoteli mpya (`pending` → `active`).
  - Badilisha maelezo ya hoteli.
  - **Taarifa za kodi na ankara** kwa kila hoteli — **TIN** na **VRN** vinavyochapishwa kwenye ankara, pamoja na picha za **sahihi na muhuri** zinazoonekana juu ya mstari wa sahihi kwenye kila PDF ya ankara.
  - **Washa / zima mbinu za malipo** kwa kila hoteli — ikijumuisha kuwasha/kuzima **Selcom**.
- **Reports** — ripoti za jumla.
- **Profile** — akaunti na nenosiri.

> Malipo ya mtandaoni yanatoa mbinu ambazo hoteli imewasha tu. **Selcom huja imezimwa kwa kawaida**; msimamizi mkuu ndiye anaiwasha kwa kila hoteli.

---

## 23. Jopo la Mmiliki (wamiliki wa hoteli nyingi)

Akaunti ya **mmiliki** ni kwa mtu anayemiliki **hoteli zaidi ya moja**. Kuingia mara moja hufunika hoteli zote — hakuna haja ya akaunti tofauti kwa kila hoteli.

- **Dashibodi ya Hoteli Zangu** — jumla zilizochanganywa za hoteli zote: mapato (siku 30), wastani wa ukaaji, wageni walio ndani, nafasi zilizo hai na jumla ya vyumba, pamoja na jedwali la ulinganisho wa hoteli.
- **Uchunguzi wa hoteli** — bonyeza jina la hoteli kuona maelezo yake: mawasiliano, TIN/VRN, vyumba, ukaaji, wageni walio ndani, nafasi zilizo hai na mapato (siku 30 + jumla).
- **Wasifu** — sasisha maelezo yako ya kibinafsi, picha ya wasifu na nenosiri.

<figure><img src="images/owner-dashboard.png" alt="Dashibodi ya mmiliki"><figcaption>Dashibodi ya mmiliki — jumla za KPIs na jedwali la kulinganisha hoteli kwa kila hoteli unayomiliki.</figcaption></figure>
<figure><img src="images/owner-hotel-detail.png" alt="Uchunguzi wa hoteli ya mmiliki"><figcaption>Uchunguzi wa hoteli — mawasiliano, vyumba, ukaaji, wageni walio ndani na mapato ya hoteli moja.</figcaption></figure>
<figure><img src="images/owner-profile.png" alt="Ukurasa wa wasifu wa mmiliki"><figcaption>Wasifu wa mmiliki — hariri maelezo yako, picha na nenosiri.</figcaption></figure>

Msimamizi mkuu huunda akaunti za wamiliki na kuwatengewa hoteli (Hotel Management → chagua hoteli → kadi ya **Mmiliki**).

---

## 24. Lugha

Tumia kitufe cha **EN / SW** kwenye upau wa juu kubadilisha mfumo mzima kati ya Kiswahili na Kiingereza. Chaguo lako linakumbukwa.

---

## 25. Utatuzi wa Matatizo

| Tatizo | Suluhisho |
| --- | --- |
| Onyo la "Unauthenticated" wakati wa kuingia | Futa kikao kilichohifadhiwa: fungua DevTools → Application → Session Storage → futa `auth_token`, kisha burudisha na ingia tena. |
| "Country field is required" wakati wa kuhifadhi | Chagua nchi kwenye orodha ya kuteua (inajaza nchi ya mgeni). |
| Nenosiri limeisha muda | Mfumo huliweka upya kuwa jina lako kamili kwa herufi kubwa; ingia kisha ubadili kutoka Profile. |
| Hunawezi kuona menyu | Nafasi hiyo hairuhusiwi menyu hiyo. Uliza msimamizi wa hoteli au msimamizi mkuu. |
| Ukurasa umechelewa kusasishwa | Burudisha kwa nguvu kwa Ctrl+Shift+R. |

---

## 26. Tovuti ya Kujitolea ya Wateja

Hoteli zinazojiandikisha kupitia ukurasa wa bei wa TSCL zinatumia **Tovuti ya Wateja** kusimamia usajili wao, kuona malipo, na kusasisha maelezo ya hoteli — bila kuhitaji msaada wa msimamizi mkuu.

### 26.1 Kujiandikisha

1. Tembelea **tscl.app/portal/pricing** kuona mipango inayopatikana (Mwanzo, Ukuaji, Biashara)
2. Bofya **Anza Sasa** kwenye mpango unaoipenda
3. Jaza fomu ya usajili:
   - Jina la hoteli, mtu wa mawasiliano, barua pepe, simu, mji, nchi
   - **Usajili wa kisheria**: Nambari ya TIN, nambari ya VRN (ikiwa inatumika), nambari ya usajili wa biashara, nchi ya usajili
   - Nenosiri (herufi 8 ndogo zaidi)
4. Bofya **Unda akaunti** — akaunti yako itasubiri uidhinishaji na siku 14 za jaribio bila malipo

### 26.2 Kuingia

1. Tembelea **tscl.app/portal/login**
2. Weka barua pepe yako na nenosiri
3. Utaelekezwa kwenye dashibodi yako ya tovuti

### 26.3 Dashibodi ya Tovuti

Dashibodi inaonyesha:
- **Bendera ya jaribio** na hesabu ya nyuma (ikiwa kwenye jaribio)
- **Kadi za KPI**: vyumba, nafasi, wageni, mapato
- **Hatua za haraka**: ruka kwenye maelezo ya hoteli, usajili, au wafanyakazi
- **Taarifa za akaunti**: mpango wa sasa, hali, subdomain, mwisho wa jaribio

### 26.4 Usimamizi wa Usajili

Tembelea **/portal/subscription** ili:
- Kuona mpango wako wa sasa na hali ya jaribio
- **Kubadilisha** kati ya mipango Mwanzo, Ukuaji, na Biashara
- Mabadiliko yanafanya kazi mara moja

### 26.5 Kulipa

Tembelea **/portal/payments** ili:
- Kuona historia ya malipo na utafiti na vichujio
- **Lipa mpya** kupitia:
  - **Pesa za Simu**: M-Pesa, Tigo Pesa, Pesa ya Airtel, HaloPesa, EzyPesa — utapokea tangazo la USSD kwenye simu yako
  **Uhamisho wa Benki**: Chagua benki yako (CRDB, NMB, Stanbic, ABSA, NCBA, Equity), weka nambari ya akaunti na reference ya muamala — inarekodiwa kama inasubiri hadi ikishwa na timu yetu

### 26.6 Maelezo ya Hoteli

Tembelea **/portal/hotel** ili kusasisha:
- Jina la hoteli, mtu wa mawasiliano, simu, mji, nchi
- Nambari za TIN na VRN
- (Subdomain na barua pepe ni za kusoma tu)

### 26.7 Usimamizi wa Wafanyakazi

Tembelea **/portal/staff** ili:
- Kuona wafanyakazi wote na utafiti na vichujio vya nafasi
- Kuona bendera za nafasi na viashiria ya hali

---

*Mwisho wa mwongozo — © MRK Hotels. Kwa msaada wasiliana na msimamizi wa hoteli yako.*
