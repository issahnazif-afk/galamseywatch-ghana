"""Hand-curated place lists. Every name must match data/shared/districts.geojson (tests check this).
Selection reflects public reporting (see docs/SOURCES.md); it is a screening list, not an allegation."""

# district, pill code, river system, weight used ONLY by the synthetic sample
MINING = [
 ("Amansie Central","AMC","Offin",1.0),("Amansie West","AMW","Offin",.95),("Amansie South","AMS","Offin / Oda",.8),
 ("Upper Denkyira East","UDE","Offin",.95),("Upper Denkyira West","UDW","Offin",.8),("Obuasi East","OBE","Offin / Jimi",.6),
 ("Adansi South","ADS","Pra",.8),("Adansi North","ADN","Pra",.65),("Twifo Atti-Morkwa","TAM","Pra",.85),
 ("Wassa East","WAS","Pra",.9),("Shama","SHA","Pra (lower)",.45),("Assin North","ASN","Pra / Ofin",.55),
 ("Prestea-Huni Valley","PHV","Ankobra",.95),("Tarkwa Nsuaem","TKN","Bonsa / Ankobra",.8),("Wassa Amenfi East","WAF","Ankobra",.9),
 ("Wassa Amenfi Central","WAC","Ankobra / Tano",.75),("Wassa Amenfi West","WAW","Tano",.7),("Aowin","AOW","Tano",.6),
 ("Sefwi-Wiawso","SWW","Tano",.55),("Bibiani-Anhwiaso-Bekwai","BAB","Tano / Ankobra",.6),
 ("Atiwa West","ATW","Birim / Atewa headwaters",.9),("Atiwa East","ATE","Birim / Atewa headwaters",.8),("Abuakwa South","ABS","Birim",.85),
 ("Kwaebibirem","KWB","Birim",.75),("Birim Central","BIC","Birim",.65),("Birim North","BIN","Birim / Pra",.7),("Denkyembour","DKB","Birim",.75),
 ("Ayensuano","AYE","Ayensu / Densu",.6),("Bole","BOL","Black Volta",.5),("Talensi","TAL","White Volta",.4),
]

# raw-water intakes reported as affected. Positions are approximate (to the nearest few km).
INTAKES = [
 ("Daboase","Pra",5.14,-1.65,"Wassa East"),("Sekyere Hemang","Pra",5.21,-1.50,"Twifo Hemang Lower Denkyira"),
 ("Kyebi","Birim",6.17,-0.55,"Abuakwa South"),("Barekese","Offin",6.85,-1.71,"Atwima Nwabiagya North"),
 ("Kwanyako","Ayensu",5.63,-0.65,"Agona East"),("Winneba","Ayensu",5.40,-0.63,"Effutu"),
 ("Weija","Densu",5.57,-0.35,"Weija Gbawe"),("Sefwi-Wiawso","Tano",6.21,-2.49,"Sefwi-Wiawso"),
]

U,R,D,C = "urban","river","dam","coast"
# district, code, mechanisms, drainage factor (<1 = floods on less rain), river name, river point (lat, lon) or None, dam id, note
FLOOD = [
 # Greater Accra: pluvial / drain capacity
 ("Accra Metropolis","ACC",[U],.80,"Odaw / Korle",None,None,"Central business area drains to the Korle Lagoon"),
 ("Korle Klottey","KOK",[U],.75,"Odaw / Korle",None,None,"Odawna, Osu Doku and the main drain are on NADMO's list"),
 ("Ayawaso North","AYN",[U],.78,"Odaw",None,None,"Burukutu Drain and Commandos are on NADMO's list"),
 ("Ayawaso East","AYE",[U],.78,"Odaw",None,None,"Dense settlement along the Odaw drain"),
 ("Ayawaso Central","AYC",[U],.80,"Odaw",None,None,"Dense settlement along the Odaw drain"),
 ("Ayawaso West","AYW",[U],.82,"Odaw",None,None,"Upper Odaw drains cross this district"),
 ("Ablekuma Central","ABC",[U],.82,"Mokwe / Korle",None,None,"Low-lying drains towards Korle"),
 ("Ledzokuku","LED",[U],.80,"Mamahuma / Kpeshie",None,None,"Teshie areas are on NADMO's list"),
 ("La Dade-Kotopon","LAD",[U],.85,"Kpeshie",None,None,"Kpeshie Lagoon catchment"),
 ("Ga East","GAE",[U],.85,"Upper Odaw / Onyasia",None,None,"Foot of the Akwapim hills, fast runoff"),
 ("Ga West","GAW",[U],.90,"Densu",None,None,"Rapid urban growth"),
 ("Ga South","GAS",[U,D],.88,"Densu",(5.60,-0.36),"weija","Downstream of Weija Dam"),
 ("Weija Gbawe","WGB",[U,D],.82,"Densu",(5.56,-0.34),"weija","Directly downstream of Weija Dam"),
 ("Adenta","ADE",[U],.88,"Sakumo tributaries",None,None,"Sakumo catchment"),
 ("Ashaiman","ASH",[U],.82,"Sakumo",None,None,"Dense settlement, Sakumo catchment"),
 ("Tema Metropolitan","TMA",[U,C],.88,"Sakumo",None,None,"Sakumo Ramsar catchment and coast"),
 ("Kumasi Metropolitan","KMA",[U],.82,"Subin / Wiwi",None,None,"Urban drains, Subin channel"),
 ("Asokwa","ASK",[U],.84,"Subin / Oda",None,None,"Urban drains"),
 ("Oforikrom","OFK",[U],.85,"Wiwi",None,None,"Urban drains"),
 ("Asokore Mampong","ASM",[U],.82,"Aboabo",None,None,"Aboabo stream corridor"),
 ("Sekondi Takoradi Metropolis","STM",[U,C],.85,"Kansawrodo",None,None,"Low-lying coastal city"),
 ("Cape Coast Metropolitan","CCM",[U,C],.88,"Kakum",None,None,"Coastal city, Fosu Lagoon"),
 ("Agona West","AGW",[U,R],.85,"Akora",None,None,"Swedru, flood disaster in 2010"),
 ("Atiwa West","ATW",[U,R],.92,"Birim",None,None,"Atiwa floods in 2011"),
 ("Tamale Metropolitan","TML",[U],.85,"Nabogo tributaries",None,None,"Flat terrain, urban drains"),
 ("Sagnerigu","SAG",[U],.88,"Nabogo tributaries",None,None,"Flat terrain, urban drains"),
 # White Volta and Bagre spill path
 ("Talensi","TLN",[R,D],.90,"White Volta",(10.60,-0.86),"bagre","Pilot district of the Volta Basin warning project"),
 ("Bawku West","BKW",[R,D],.90,"White Volta",(10.85,-0.45),"bagre","Pilot district of the Volta Basin warning project"),
 ("Bawku","BAW",[R,D],.92,"White Volta",(10.95,-0.30),"bagre","Pilot district of the Volta Basin warning project"),
 ("Binduri","BIN",[R,D],.90,"White Volta",(10.95,-0.28),"bagre","Pilot district of the Volta Basin warning project"),
 ("Nabdam","NAB",[R,D],.92,"White Volta",(10.78,-0.68),"bagre","Pilot district of the Volta Basin warning project"),
 ("Pusiga","PUS",[R,D],.92,"White Volta",(11.05,-0.12),"bagre","Close to the Burkina Faso border"),
 ("West Mamprusi","WMA",[R,D],.92,"White Volta",(10.40,-0.95),"bagre","White Volta floodplain"),
 ("Mamprugu Moagduri","MAM",[R,D],.92,"White Volta",(10.15,-1.05),"bagre","White Volta floodplain"),
 ("East Mamprusi","EMA",[R,D],.95,"White Volta / Morago",(10.50,-0.40),"bagre","White Volta tributaries"),
 ("Savelugu","SVL",[R,D],.95,"White Volta",(9.80,-0.95),"bagre","White Volta floodplain"),
 ("Kumbungu","KBG",[R,D],.92,"White Volta",(9.68,-1.02),"bagre","White Volta floodplain near Nawuni"),
 ("North Gonja","NGJ",[R,D],.92,"White Volta",(9.53,-1.38),"bagre","White Volta floodplain near Daboya"),
 ("Central Gonja","CGJ",[R],.95,"White Volta",(9.10,-1.10),None,"Lower White Volta floodplain"),
 # Black Volta and Oti
 ("Bole","BLE",[R],.95,"Black Volta",(9.10,-2.65),None,"Black Volta floodplain"),
 ("Wa West","WAW",[R],.95,"Black Volta",(9.90,-2.75),None,"Black Volta floodplain"),
 ("Banda","BDA",[R],.95,"Black Volta",(8.20,-2.15),None,"Black Volta near the Bui reservoir"),
 ("Saboba","SBB",[R],.95,"Oti",(9.45,0.25),None,"Oti floodplain"),
 ("Krachi East","KRE",[R],.95,"Oti",(7.85,0.10),None,"Oti arm of Lake Volta"),
 # Lower Volta: Akosombo / Kpong spill path
 ("Asuogyaman","ASG",[R,D],.92,"Lower Volta",(6.27,0.07),"akosombo","Immediately below Akosombo"),
 ("Lower Manya","LMK",[R,D],.92,"Lower Volta",(6.12,0.10),"akosombo","Below Kpong"),
 ("Shai Osudoku","SOD",[R,D],.92,"Lower Volta",(6.05,0.18),"akosombo","Lower Volta floodplain"),
 ("North Tongu","NTO",[R,D],.88,"Lower Volta",(6.10,0.40),"akosombo","Includes Mepe and Battor, worst hit in 2023"),
 ("Central Tongu","CTO",[R,D],.90,"Lower Volta",(6.02,0.50),"akosombo","Lower Volta islands and floodplain"),
 ("South Tongu","STO",[R,D],.90,"Lower Volta",(6.00,0.60),"akosombo","Includes Sogakope"),
 ("Ada East","ADA",[R,D,C],.90,"Lower Volta estuary",(5.80,0.63),"akosombo","Estuary: river and sea meet"),
 ("Ada West","ADW",[R,D,C],.92,"Lower Volta estuary",(5.85,0.50),"akosombo","Lower Volta estuary plain"),
 # Keta coast: tidal waves
 ("Keta","KET",[C,U],.85,"Keta Lagoon",None,None,"Repeated tidal surges along the Keta barrier"),
 ("Anloga","ANL",[C,U],.85,"Keta Lagoon",None,None,"Displacement from tidal waves"),
 ("Ketu South","KTS",[C,U],.85,"Keta Lagoon",None,None,"Displacement from heavy rain and tidal waves"),
]

# Starting 24 h rainfall thresholds (mm) for advisory, watch, warning, severe, by climate belt.
# Scaled by each district's drainage factor. Must be calibrated (docs/FLOOD_METHOD.md).
BELT = {"coastal":[30,50,80,120],"forest":[40,65,100,150],"transition":[35,60,90,135],"savanna":[35,60,90,130]}
BELT_BY_REGION = {"Greater Accra":"coastal","Central":"coastal","Western":"forest","Western North":"forest","Ashanti":"forest","Eastern":"forest","Ahafo":"forest",
 "Volta":"transition","Oti":"transition","Bono":"transition","Bono East":"transition","Northern":"savanna","Savannah":"savanna","North East":"savanna","Upper East":"savanna","Upper West":"savanna"}
