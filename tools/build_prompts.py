"""Builds data/prompts.json for DeepRecall.
Format per category: tier letter, colon, answers separated by |, aliases joined with =.
C=common F=familiar U=uncommon R=rare V=very_rare L=legendary T=too_clever
"""
import json, re, os, sys

TIERS = {"C": "common", "F": "familiar", "U": "uncommon", "R": "rare",
         "V": "very_rare", "L": "legendary", "T": "too_clever"}

P = []
def add(prompt, body, people=False):
    P.append((prompt, body, people))

add("Name a web browser", """
C: Chrome=google chrome|Safari|Firefox=mozilla firefox
F: Edge=microsoft edge|Opera|Internet Explorer=ie
U: Brave|Vivaldi|DuckDuckGo
R: Tor Browser=tor|Opera GX|Arc|Samsung Internet
V: Maxthon|Pale Moon|Waterfox|SeaMonkey|Midori|Konqueror
L: Lynx|Mosaic=ncsa mosaic|Netscape Navigator=netscape|WorldWideWeb|Links|Dillo
""")
add("Name a farm animal", """
C: Cow|Pig|Chicken|Horse|Sheep|Goat
F: Duck|Turkey|Donkey|Rabbit
U: Llama|Alpaca|Goose|Ox
R: Mule|Guinea Fowl|Emu|Ostrich|Water Buffalo|Yak
V: Bison|Peacock=peafowl|Quail|Pheasant|Camel|Reindeer
L: Zebu|Hinny|Banteng|Gayal=mithun
""")
add("Name a country in Africa", """
C: Egypt|South Africa|Nigeria|Kenya
F: Morocco|Ethiopia|Ghana|Madagascar|Algeria
U: Tanzania|Uganda|Senegal|Somalia|Libya|Sudan|Tunisia|Zimbabwe
R: Mali|Namibia|Botswana|Angola|Rwanda|Cameroon|Mozambique|Zambia|Niger|Chad|Ivory Coast=cote d'ivoire
V: Malawi|Burkina Faso|Benin|Togo|Gabon|Guinea|Sierra Leone|Liberia|Mauritania|Eritrea|South Sudan|Burundi|Lesotho|Mauritius|Central African Republic=car|Democratic Republic of the Congo=drc=dr congo|Republic of the Congo=congo
L: Djibouti|Eswatini=swaziland|Comoros|Seychelles|Cape Verde=cabo verde|Gambia=the gambia|Equatorial Guinea|Guinea-Bissau|Sao Tome and Principe
""")
add("Name a moon in our solar system", """
C: The Moon=moon=luna
F: Europa|Titan|Io|Ganymede
U: Callisto|Phobos|Deimos|Enceladus|Triton
R: Charon|Mimas|Titania|Oberon|Miranda|Rhea|Iapetus
V: Ariel|Umbriel|Dione|Tethys|Hyperion|Nereid|Amalthea|Phoebe
L: Proteus|Dysnomia|Hiiaka|Pan|Daphnis|Metis|Thebe|Styx|Kerberos|Nix|Hydra
""")
add("Name a fruit", """
C: Apple|Banana|Orange|Strawberry|Grape
F: Mango|Pineapple|Watermelon|Peach|Pear|Cherry|Blueberry
U: Kiwi|Papaya|Pomegranate|Plum|Lime|Grapefruit|Coconut|Raspberry|Lemon
R: Lychee|Dragon Fruit=pitaya|Passion Fruit|Guava|Fig|Persimmon|Apricot|Cantaloupe|Blackberry|Nectarine
V: Rambutan|Durian|Jackfruit|Star Fruit=carambola|Kumquat|Quince|Gooseberry|Mangosteen|Loquat|Tamarind
L: Salak=snake fruit|Cherimoya|Feijoa|Jabuticaba|Pawpaw|Medlar|Soursop|Longan|Ackee|Cupuacu|Miracle Fruit|Lucuma
T: Tomato|Avocado|Cucumber|Pumpkin
""")
add("Name a vegetable", """
C: Carrot|Broccoli|Potato|Lettuce|Corn|Onion
F: Spinach|Cucumber|Celery|Peas=pea|Green Beans|Cabbage|Cauliflower|Bell Pepper=pepper
U: Zucchini|Asparagus|Kale|Eggplant|Sweet Potato|Brussels Sprouts|Radish|Beet
R: Leek|Artichoke|Okra|Parsnip|Turnip|Bok Choy|Squash|Garlic
V: Kohlrabi|Rutabaga|Fennel|Jicama|Chard=swiss chard|Daikon|Arugula|Watercress|Endive
L: Salsify|Romanesco|Celeriac|Sunchoke=jerusalem artichoke|Fiddlehead|Cardoon|Mizuna|Burdock|Taro|Chayote|Samphire
T: Tomato|Mushroom
""")
add("Name a dog breed", """
C: Labrador Retriever=labrador=lab|Golden Retriever|German Shepherd|Poodle|Bulldog|Chihuahua|Beagle
F: Siberian Husky=husky|Pug|Dachshund|Boxer|Rottweiler|Corgi|Pit Bull
U: Shih Tzu|Border Collie|Great Dane|Doberman|Yorkshire Terrier=yorkie|Dalmatian|Pomeranian|Maltese
R: Shiba Inu|Akita|Saint Bernard|Bernese Mountain Dog|Basset Hound|Greyhound|Whippet|Samoyed|Newfoundland|Weimaraner
V: Basenji|Vizsla|Shar Pei|Bichon Frise|Rhodesian Ridgeback|Afghan Hound|Bloodhound|Papillon|Schipperke|Komondor
L: Xoloitzcuintli=xolo|Lagotto Romagnolo|Azawakh|Bergamasco|Otterhound|Mudi|Puli|Catahoula|Kooikerhondje|Norwegian Lundehund|Peruvian Inca Orchid
""")
add("Name a musical instrument", """
C: Piano|Guitar|Drums|Violin|Flute
F: Trumpet|Saxophone|Clarinet|Cello|Bass|Harp|Ukulele
U: Trombone|Tuba|Oboe|Harmonica|Banjo|Xylophone|Accordion
R: Bassoon|French Horn|Mandolin|Viola|Bagpipes|Tambourine|Triangle|Piccolo
V: Sitar|Didgeridoo|Theremin|Harpsichord|Glockenspiel|Marimba|Ocarina|Kalimba|Steel Drum
L: Hurdy-Gurdy|Erhu|Shamisen|Oud|Kora|Sackbut|Celesta|Ondes Martenot|Bandoneon|Nyckelharpa|Duduk|Glass Harmonica
T: Voice|Kazoo
""")
add("Name a board game", """
C: Monopoly|Chess|Scrabble|Checkers
F: Clue=cluedo|Candy Land|Sorry|Risk|The Game of Life=life|Battleship
U: Catan=settlers of catan|Trouble|Connect Four|Chutes and Ladders|Backgammon|Go|Operation
R: Ticket to Ride|Pandemic|Carcassonne|Mancala|Stratego|Othello|Trivial Pursuit
V: Azul|Wingspan|Agricola|Dominion|Codenames|Splendor|Gloomhaven|Twilight Imperium
L: Senet|Hnefatafl|Diplomacy|Terraforming Mars|Brass|Royal Game of Ur=game of ur|Shogi|Xiangqi|Puerto Rico|Power Grid
""")
add("Name an element on the periodic table", """
C: Oxygen|Hydrogen|Carbon|Gold|Iron|Helium
F: Nitrogen|Silver|Copper|Sodium|Calcium|Neon
U: Aluminum=aluminium|Lead|Zinc|Uranium|Mercury|Chlorine|Platinum|Potassium
R: Lithium|Magnesium|Sulfur|Titanium|Tin|Nickel|Plutonium|Argon|Silicon|Iodine
V: Tungsten|Cobalt|Krypton|Xenon|Radon|Fluorine|Boron|Arsenic|Chromium|Manganese|Phosphorus
L: Praseodymium|Ytterbium|Rhenium|Hafnium|Oganesson|Tennessine|Promethium|Dysprosium|Gadolinium|Lutetium|Technetium|Francium|Moscovium
""")
add("Name a U.S. state", """
C: California|Texas|Florida|New York
F: Hawaii|Alaska|Washington|Ohio|Georgia|Arizona|Nevada
U: Colorado|Michigan|Illinois|Oregon|Pennsylvania|Massachusetts|Virginia|Tennessee|Louisiana
R: Utah|Minnesota|Wisconsin|Kentucky|Alabama|Missouri|Oklahoma|North Carolina|South Carolina|New Jersey|Maryland|Indiana|Iowa|Kansas|Connecticut|New Mexico|Mississippi|Arkansas
V: Idaho|Montana|Nebraska|Maine|Vermont|New Hampshire|West Virginia|South Dakota
L: Wyoming|North Dakota|Delaware|Rhode Island
""")
add("Name a sport", """
C: Soccer=association football|Basketball|Baseball|American Football=football|Tennis
F: Hockey=ice hockey|Golf|Volleyball|Swimming|Boxing
U: Rugby|Cricket|Wrestling|Badminton|Lacrosse|Table Tennis=ping pong|Skiing|Track and Field|Pickleball
R: Fencing|Water Polo|Rowing|Archery|Curling|Surfing|Field Hockey|Handball|Gymnastics
V: Squash|Polo|Bobsled|Luge|Skeleton|Biathlon|Kabaddi|Netball|Hurling
L: Sepak Takraw|Bossaball|Buzkashi|Jai Alai|Korfball|Underwater Hockey|Chess Boxing|Bandy|Kin-Ball|Pesapallo|Gaelic Football
""")
add("Name a color", """
C: Red|Blue|Green|Yellow|Purple|Orange|Black|White
F: Pink|Brown|Gray=grey
U: Turquoise|Magenta|Teal|Navy|Maroon|Beige|Lavender|Cyan|Gold|Silver
R: Indigo|Crimson|Violet|Burgundy|Coral|Olive|Lime|Peach|Tan|Mint
V: Chartreuse|Vermilion|Cerulean|Mauve|Fuchsia|Ochre|Periwinkle|Taupe|Sienna|Ecru|Puce
L: Coquelicot|Falu Red|Wenge|Gamboge|Smaragdine|Glaucous|Zaffre|Xanadu|Amaranth|Celadon|Heliotrope|Isabelline
""")
add("Name a shape", """
C: Circle|Square|Triangle|Rectangle
F: Oval|Star|Heart|Diamond|Pentagon|Hexagon
U: Octagon|Trapezoid|Rhombus|Parallelogram|Cube|Sphere|Cone|Pyramid|Cylinder
R: Heptagon|Ellipse|Crescent|Kite|Prism|Decagon|Nonagon
V: Dodecahedron|Icosahedron|Tetrahedron|Octahedron|Torus|Trefoil|Annulus|Deltoid
L: Reuleaux Triangle|Rhombicuboctahedron|Gomboc|Hendecagon|Klein Bottle|Mobius Strip|Lemniscate|Astroid|Cardioid|Superellipse
""")
add("Name a language", """
C: English|Spanish|French|Chinese=mandarin
F: German|Japanese|Italian|Russian|Arabic|Portuguese|Korean|Hindi
U: Dutch|Greek|Swedish|Polish|Turkish|Hebrew|Vietnamese|Latin|Bengali|Urdu|Tagalog=filipino
R: Swahili|Thai|Persian=farsi|Punjabi|Tamil|Norwegian|Finnish|Danish|Ukrainian|Indonesian|Cantonese|Gujarati|Telugu
V: Icelandic|Welsh|Irish=irish gaelic|Basque|Hungarian|Amharic|Yoruba|Zulu|Hawaiian|Navajo|Malayalam|Kannada|Marathi|Esperanto|Sanskrit
L: Quechua|Guarani|Ainu|Inuktitut|Faroese|Maltese|Sami|Cherokee|Tok Pisin|Xhosa|Manx|Aramaic
T: Klingon|Python|Sign Language
""")
add("Name a bird", """
C: Eagle|Robin|Pigeon|Crow|Parrot|Owl
F: Penguin|Flamingo|Hawk|Blue Jay|Cardinal|Hummingbird|Seagull=gull|Sparrow
U: Ostrich|Peacock|Woodpecker|Pelican|Swan|Toucan|Falcon|Vulture|Raven|Duck
R: Heron|Crane|Stork|Kingfisher|Albatross|Emu|Puffin|Magpie|Finch|Canary|Cockatoo|Macaw|Kiwi
V: Cassowary|Hoopoe|Shoebill|Kookaburra|Roadrunner|Nightingale|Lyrebird|Oriole|Tanager|Ibis|Blue-footed Booby=booby|Frigatebird
L: Kakapo|Hoatzin|Potoo|Secretary Bird|Bowerbird|Quetzal|Takahe|Oilbird|Jacana|Dodo|Sunbittern|Kagu|Bee-eater|Wallcreeper
""")
add("Name a car brand", """
C: Toyota|Ford|Honda|Tesla|Chevrolet=chevy|BMW
F: Nissan|Mercedes-Benz=mercedes|Audi|Volkswagen=vw|Jeep|Hyundai|Kia|Subaru|Dodge|Lexus
U: Mazda|Ferrari|Lamborghini|Porsche|Volvo|Cadillac|GMC|Buick|Chrysler|Ram|Acura|Mitsubishi
R: Infiniti|Lincoln|Jaguar|Land Rover|Mini|Fiat|Maserati|Bentley|Rolls-Royce|Genesis|Alfa Romeo|Rivian|Lucid
V: Bugatti|McLaren|Aston Martin|Koenigsegg|Pagani|Lotus|Peugeot|Renault|Citroen|Skoda|Seat|BYD|Polestar|Suzuki|Pontiac|Saturn|Hummer|Plymouth|Oldsmobile
L: Lada|Trabant|DeLorean|Studebaker|Tatra|Saab|Rimac|Spyker|Dacia|Proton|Packard|AMC|Hudson|Morgan|Mahindra|Geely|Zastava
""")
add("Name a part of the human body", """
C: Hand|Head|Foot|Arm|Leg|Eye|Nose|Mouth
F: Ear|Finger|Knee|Elbow|Shoulder|Toe|Heart|Brain|Neck
U: Ankle|Wrist|Chin|Hip|Stomach|Lung|Liver|Kidney|Thumb|Eyebrow|Tongue
R: Spleen|Pancreas|Collarbone=clavicle|Femur|Shin|Earlobe|Appendix|Gallbladder|Esophagus|Rib|Skull
V: Philtrum|Uvula|Septum|Larynx|Diaphragm|Thyroid|Tibia|Sternum|Patella=kneecap|Coccyx=tailbone|Cornea|Retina|Achilles Tendon
L: Glabella|Lunula|Hallux|Pinna|Tragus|Canthus|Nares|Popliteal Fossa|Columella|Vomer|Hyoid|Stapes
""")
add("Name a kitchen utensil or tool", """
C: Spoon|Fork|Knife|Plate|Cup|Pan|Pot
F: Spatula|Whisk|Bowl|Ladle|Tongs|Blender|Toaster|Microwave|Oven
U: Colander|Grater|Peeler|Rolling Pin|Cutting Board|Can Opener|Measuring Cup|Kettle|Strainer
R: Mortar and Pestle|Zester|Wok|Dutch Oven|Skillet|Baster|Slotted Spoon|Corkscrew|Sieve|Funnel
V: Mandoline|Ramekin|Mezzaluna|Chinois|Spider Strainer=spider|Salad Spinner|Garlic Press|Bench Scraper|Tagine|Molcajete
L: Tamis|Spurtle|Couscoussier|Bain-Marie|Reamer=lemon reamer|Food Mill=mouli|Dredger|Larding Needle|Tortilla Press|Comal|Suribachi|Donabe
""")
add("Name a pizza topping", """
C: Pepperoni|Cheese=mozzarella|Sausage|Mushroom=mushrooms
F: Olive=olives|Onion=onions|Green Peppers=peppers|Pineapple|Ham|Bacon
U: Chicken|Jalapeno=jalapenos|Spinach|Tomato=tomatoes|Basil|Anchovy=anchovies|Ground Beef=beef
R: Artichoke|Garlic|Feta|Ricotta|Arugula|Banana Peppers|Salami|Prosciutto|Meatball=meatballs|Sun-dried Tomatoes
V: Capers|Goat Cheese|Pesto|Fig=figs|Truffle|Egg|Corn|Shrimp|Clams|Gorgonzola|Soppressata|Nduja
L: Potato|Kimchi|Lobster|Duck|Brussels Sprouts|Pear|Hot Honey=honey|Pistachio|Mortadella|Guanciale
""")
add("Name a dinosaur", """
C: Tyrannosaurus Rex=t rex=trex=tyrannosaurus|Triceratops|Velociraptor=raptor|Stegosaurus
F: Brachiosaurus|Spinosaurus|Ankylosaurus|Diplodocus|Brontosaurus
U: Allosaurus|Parasaurolophus|Iguanodon|Pachycephalosaurus|Dilophosaurus|Apatosaurus
R: Carnotaurus|Giganotosaurus|Archaeopteryx|Compsognathus|Gallimimus|Therizinosaurus|Argentinosaurus|Oviraptor|Deinonychus
V: Baryonyx|Microraptor|Maiasaura|Protoceratops|Edmontosaurus|Utahraptor|Styracosaurus|Mamenchisaurus|Corythosaurus|Suchomimus
L: Nigersaurus|Amargasaurus|Kosmoceratops|Yutyrannus|Mononykus|Dreadnoughtus|Masiakasaurus|Eoraptor|Herrerasaurus|Sinosauropteryx|Pentaceratops|Minmi
T: Pterodactyl=pteranodon|Mosasaurus|Plesiosaurus|Dimetrodon|Chicken
""")
add("Name an ocean animal", """
C: Shark|Whale|Dolphin|Octopus|Jellyfish
F: Starfish=sea star|Crab|Lobster|Seal|Sea Turtle|Squid|Clownfish|Stingray
U: Orca=killer whale|Sea Otter|Walrus|Manatee|Seahorse|Eel|Shrimp|Barracuda|Tuna|Manta Ray
R: Narwhal|Beluga|Pufferfish|Swordfish|Sea Urchin|Sea Lion|Hammerhead|Anglerfish|Coral|Barnacle|Krill
V: Dugong|Nudibranch|Sea Cucumber|Cuttlefish|Nautilus|Lionfish|Moray Eel|Oarfish|Ocean Sunfish=sunfish=mola mola|Blobfish|Sea Anemone|Lamprey
L: Vampire Squid|Gulper Eel|Siphonophore|Sea Pig|Frilled Shark|Goblin Shark|Dumbo Octopus|Barreleye|Sea Butterfly|Yeti Crab|Pyrosome|Leafy Sea Dragon|Vaquita|Comb Jelly
""")
add("Name an insect", """
C: Ant|Bee|Butterfly|Fly|Mosquito|Ladybug
F: Cockroach|Grasshopper|Beetle|Dragonfly|Moth|Wasp|Cricket|Firefly
U: Termite|Flea|Praying Mantis=mantis|Caterpillar|Hornet|Stink Bug|Cicada|Louse=lice|Gnat
R: Stick Insect=walking stick|Earwig|Weevil|Silverfish|Aphid|Katydid|Damselfly|Bed Bug|Yellowjacket|Mayfly
V: Dung Beetle|Water Strider|Lacewing|Antlion|Hercules Beetle|Leafcutter Ant|Bombardier Beetle|Assassin Bug|Thrips|Caddisfly|Cochineal
L: Goliath Beetle|Orchid Mantis|Weta|Treehopper|Scorpionfly|Bullet Ant|Snakefly|Stonefly|Webspinner|Mantisfly|Jewel Wasp|Tarantula Hawk
T: Spider|Scorpion|Tick|Centipede|Millipede|Woodlouse=pill bug
""")
add("Name something in a classroom", """
C: Desk|Chair|Whiteboard|Pencil|Book|Teacher
F: Chalkboard|Clock|Computer|Backpack|Notebook|Eraser|Ruler|Projector|Flag
U: Globe|Map|Stapler|Calculator|Scissors|Pencil Sharpener|Marker|Trash Can|Poster|Bookshelf
R: Tissue Box|Hand Sanitizer|Glue Stick|Hole Punch|Thermostat|Smoke Detector|Fire Extinguisher|Bulletin Board|Intercom|Blinds
V: Protractor|Compass|Document Camera|Overhead Projector|Hall Pass|Seating Chart|Lost and Found|Pencil Case|Exit Sign|Periodic Table|Lesson Plan
L: Abacus|Mimeograph|Inkwell|Slide Rule|Evacuation Map|Sprinkler Head|Pointer Stick=pointer|Pencil Shavings
T: Gum|Dust|Germs
""")
add("Name a superpower", """
C: Flight=flying|Invisibility|Super Strength=strength|Super Speed=speed
F: Telekinesis|Teleportation|Mind Reading=telepathy|X-ray Vision|Time Travel|Healing
U: Shapeshifting|Immortality|Laser Eyes|Mind Control|Regeneration|Invulnerability|Time Stopping=freeze time
R: Precognition|Elasticity|Shrinking|Weather Control|Pyrokinesis|Cryokinesis|Animal Communication|Intangibility=phasing|Duplication
V: Technopathy|Power Absorption|Probability Manipulation|Sonic Scream|Echolocation|Electrokinesis|Hydrokinesis|Photographic Memory|Night Vision|Wall Crawling|Magnetism
L: Chronokinesis|Reality Warping|Omnilingualism|Astral Projection|Density Control|Biokinesis|Power Mimicry|Molecular Manipulation|Pocket Dimension
""")
add("Name a job", """
C: Teacher|Doctor|Nurse|Police Officer=cop=police|Firefighter
F: Lawyer|Chef|Engineer|Pilot|Dentist|Farmer|Cashier|Mechanic|Scientist
U: Accountant|Architect|Electrician|Plumber|Pharmacist|Veterinarian=vet|Librarian|Waiter=server=waitress|Barber|Carpenter|Programmer=software engineer
R: Astronaut|Judge|Surgeon|Journalist|Photographer|Translator|Paramedic|Welder|Zookeeper|Lifeguard|Janitor=custodian|Florist|Baker
V: Actuary|Cartographer|Taxidermist|Sommelier|Locksmith|Glassblower|Blacksmith|Auctioneer|Mortician|Stenographer|Lumberjack|Cobbler|Arborist
L: Chandler|Cooper|Farrier|Fletcher|Wheelwright|Lamplighter|Foley Artist|Phlebotomist|Ombudsman|Volcanologist|Perfumer|Horologist|Luthier|Falconer
""")
add("Name something that's cold", """
C: Ice|Snow|Ice Cream|Freezer|Refrigerator=fridge
F: Popsicle|Antarctica|Winter|Iceberg|Glacier|Ice Cube
U: Arctic|North Pole|Slushie|Snowman|Frost|Hail|Icicle|Penguin|Ice Pack
R: Dry Ice|Liquid Nitrogen|Mount Everest|Siberia|Polar Bear|Blizzard|Igloo|Ice Rink|Pluto
V: Absolute Zero|Permafrost|Boomerang Nebula|Cryogenic Chamber|Cold Brew|Gazpacho|Sorbet|Vichyssoise|Space
L: Bose-Einstein Condensate|Oymyakon|Vostok Station|Cosmic Microwave Background|Triton|Uranus|Liquid Helium
T: Cold Shoulder|Cold Feet
""")
add("Name a breakfast food", """
C: Eggs=egg|Pancakes=pancake|Cereal|Bacon|Toast|Waffles=waffle
F: Oatmeal|Bagel|Yogurt|Sausage|Muffin|French Toast|Hash Browns
U: Omelette=omelet|Croissant|Donut=doughnut|Granola|Smoothie|Breakfast Burrito|Biscuits and Gravy|Grits
R: Eggs Benedict|Crepe=crepes|Quiche|Frittata|Avocado Toast|Scone|Cinnamon Roll|Chilaquiles|Huevos Rancheros|Danish
V: Shakshuka|Congee|Kedgeree|Porridge|Muesli|Dutch Baby|Migas|Black Pudding|Kippers|Johnnycake|Scrapple|Bubble and Squeak
L: Natto|Idli|Dosa|Menemen|Ful Medames|Khachapuri|Pao de Queijo|Tamagoyaki|Arepa|Poha|Pastel de Nata|Simit|Youtiao
""")
add("Name something with wheels", """
C: Car|Bicycle=bike|Bus|Truck|Skateboard
F: Motorcycle|Train|Scooter|Wagon|Stroller|Wheelchair|Shopping Cart
U: Tractor|Roller Skates|Wheelbarrow|Rollerblades|Tricycle|Suitcase|Office Chair|Golf Cart|Ambulance|Forklift
R: Airplane|Unicycle|Segway|Go-kart|Lawn Mower|Hand Truck=dolly|Rickshaw|Pizza Cutter|Mars Rover|Chariot|Stagecoach
V: Penny-farthing|Velocipede|Cannon|Grand Piano|Hospital Bed|Lunar Rover|Tuk-tuk|Pedicab|Soapbox Car
L: Siege Tower|Juggernaut|Velomobile|Monowheel|Zamboni|Draisine|Handcar|Sulky|Barouche|Landau
T: Tank|Hamster Wheel
""")
add("Name a holiday", """
C: Christmas|Halloween|Thanksgiving|Easter|New Year's=new years=new year
F: Valentine's Day=valentines day|Fourth of July=independence day|Hanukkah|St. Patrick's Day|Mother's Day|Father's Day
U: Diwali|Labor Day|Memorial Day|Martin Luther King Jr. Day=mlk day|Eid al-Fitr=eid|Lunar New Year=chinese new year|Passover|Cinco de Mayo|Veterans Day
R: Kwanzaa|Juneteenth|Presidents' Day|Day of the Dead=dia de los muertos|Groundhog Day|Earth Day|April Fools' Day|Yom Kippur|Rosh Hashanah|Mardi Gras|Holi|Boxing Day|Indigenous Peoples' Day=columbus day
V: Arbor Day|Bastille Day|Guy Fawkes Night|Purim|Vesak|Nowruz|Oktoberfest|Hogmanay|Mid-Autumn Festival|Songkran|Lohri|Tet
L: Festivus|Pi Day|Walpurgis Night|Up Helly Aa|Lughnasadh|Obon|Sukkot|Tu BiShvat|Setsubun|Krampusnacht|Saturnalia|Inti Raymi|Loy Krathong
""")
add("Name a gemstone", """
C: Diamond|Ruby|Emerald|Sapphire
F: Amethyst|Pearl|Opal|Topaz|Jade
U: Garnet|Quartz|Turquoise|Aquamarine|Onyx|Citrine|Peridot
R: Tanzanite|Moonstone|Jasper|Agate|Lapis Lazuli|Obsidian|Tourmaline|Amber|Malachite|Zircon|Alexandrite|Rose Quartz
V: Spinel|Tiger's Eye|Bloodstone|Carnelian|Morganite|Kunzite|Iolite|Chrysoberyl|Labradorite|Sunstone|Beryl|Jet
L: Painite|Benitoite|Taaffeite|Red Beryl=bixbite|Grandidierite|Musgravite|Jeremejevite|Poudretteite|Tsavorite|Demantoid|Ammolite|Larimar|Sugilite
""")
add("Name a type of cheese", """
C: Cheddar|Mozzarella|Swiss|Parmesan|American
F: Brie|Provolone|Gouda|Feta|Pepper Jack|Monterey Jack
U: Colby|Ricotta|Cream Cheese|Blue Cheese|Cottage Cheese|Goat Cheese=chevre|Muenster|Havarti|Camembert
R: Gruyere|Manchego|Gorgonzola|Roquefort|Halloumi|Asiago|Romano|Burrata|Mascarpone|Paneer|Stilton|Queso Fresco|Emmental
V: Fontina|Taleggio|Comte|Raclette|Limburger|Edam|Jarlsberg|Pecorino|Oaxaca|Cotija|Wensleydale|Boursin|Brunost=gjetost
L: Casu Marzu|Epoisses|Pule|Vacherin|Reblochon|Mimolette|Stinking Bishop|Tete de Moine|Cabrales|Labneh|Bryndza|Caciocavallo|Lancashire
""")
add("Name a mythical creature", """
C: Dragon|Unicorn|Mermaid|Vampire|Werewolf|Ghost
F: Zombie|Fairy|Bigfoot=sasquatch|Phoenix|Troll|Goblin|Elf
U: Centaur|Griffin=gryphon|Pegasus|Yeti|Cyclops|Minotaur|Kraken|Loch Ness Monster=nessie|Gnome|Ogre|Leprechaun|Sphinx
R: Hydra|Medusa|Chimera|Banshee|Basilisk|Chupacabra|Kitsune|Wendigo|Golem|Siren|Satyr|Harpy
V: Manticore|Kelpie|Djinn=genie|Tengu|Kappa|Selkie|Cerberus|Thunderbird|Mothman|Jackalope|Hippogriff|Nymph|Valkyrie
L: Bunyip|Qilin=kirin|Baku|Taniwha|Nuckelavee|Rokurokubi|Aswang|Strigoi|Ammit|Tikbalang|Simurgh|Lamassu|Peryton
""")
add("Name something you find at the beach", """
C: Sand|Water|Seashell=seashells=shells|Waves|Sun
F: Umbrella|Towel|Sunscreen|Sandcastle|Seagull|Crab|Lifeguard|Bucket
U: Surfboard|Boardwalk|Pier|Volleyball Net|Cooler|Flip Flops|Kite|Starfish|Seaweed|Driftwood|Lighthouse
R: Tide Pool|Sea Glass|Sand Dollar|Jellyfish|Dune|Boogie Board|Kelp|Jet Ski|Snorkel|Metal Detector|Sea Foam
V: Barnacles|Sand Flea|Lifeguard Tower|Buoy|Sandpiper|Groyne|Riptide|Tar Ball
L: Mermaid's Purse|Fulgurite|Sea Bean|Wrack Line|Ambergris|Message in a Bottle|Lugworm Cast|Bioluminescence
""")
add("Name something in space", """
C: Star|Sun|Moon|Planet|Asteroid|Comet
F: Black Hole|Galaxy|Satellite|Meteor|Nebula|Astronaut|Rocket
U: International Space Station=iss=space station|Supernova|Milky Way|Constellation|Mars|Saturn|Space Junk
R: Pulsar|Quasar|Dwarf Planet|Exoplanet|Oort Cloud|Kuiper Belt|Neutron Star|Red Giant|White Dwarf|Hubble Telescope=hubble|James Webb Telescope=jwst=james webb
V: Magnetar|Brown Dwarf|Dark Matter|Cosmic Rays|Solar Wind|Lagrange Point|Blazar|Globular Cluster|Voyager 1|Gamma-Ray Burst
L: Kilonova|Bootes Void|Great Attractor|Hypervelocity Star|Rogue Planet|Sagittarius A*=sagittarius a|Oumuamua|Tesla Roadster
T: Wormhole|Aliens
""")
add("Name a programming language", """
C: Python|JavaScript=js|Java|C++=cpp
F: C|C#=c sharp|SQL|Swift|PHP|Ruby
U: TypeScript|Go=golang|Rust|Kotlin|R|Scratch|Lua|Perl|Bash
R: MATLAB|Scala|Dart|Haskell|Assembly|Visual Basic=vb|Objective-C|Julia|Elixir|Fortran|COBOL
V: Lisp|Clojure|Erlang|Prolog|F#|OCaml|Pascal|Zig|Nim|Smalltalk|Groovy|Racket
L: APL|Forth|Ada|Simula|ALGOL|Befunge|Malbolge|LOLCODE|Whitespace|Shakespeare|Piet|Eiffel|Elm|Idris|Crystal
T: HTML|CSS|Markdown|JSON
""")
add("Name a pasta shape", """
C: Spaghetti|Macaroni|Penne|Lasagna
F: Fettuccine|Ravioli|Linguine|Rigatoni|Farfalle=bow tie=bowtie|Rotini|Tortellini
U: Angel Hair=capellini|Ziti|Shells=conchiglie|Orzo|Gnocchi|Fusilli|Manicotti|Cannelloni
R: Orecchiette|Pappardelle|Tagliatelle|Ditalini|Bucatini|Cavatappi|Gemelli|Radiatori|Campanelle|Vermicelli|Rotelle=wagon wheels
V: Casarecce|Strozzapreti|Paccheri|Trofie|Mafaldine|Agnolotti|Cappelletti|Anelli|Stelline|Acini di Pepe|Fregola|Tortiglioni
L: Lorighittas|Su Filindeu|Corzetti|Busiate|Scialatielli|Pici|Garganelli|Lumache|Torchio|Cencioni|Fazzoletti|Gigli|Creste di Gallo
""")
add("Name something that's yellow", """
C: Banana|Sun|Lemon|School Bus|Corn
F: Rubber Duck|Taxi=cab|Sunflower|Mustard|Cheese|Butter|Daffodil|Egg Yolk|Highlighter
U: Pencil|Smiley Face|Canary|Caution Sign|Tennis Ball|Sticky Note=post-it|Chick|Lemonade|Dandelion
R: Turmeric|Sulfur|Gold|Goldfinch|Hard Hat|Banana Slug|Squash|Butterscotch|Caution Tape
V: Canola Field|Yellow Jersey|Yellow Tang|Golden Poison Frog|Citrine|Forsythia|Yellow Pages
L: Orpiment|Gamboge|Yellowcake|Indian Yellow|Chrome Yellow|Ylang-ylang|Yellow Warbler
""")
add("Name a tree", """
C: Oak|Pine|Maple|Palm|Birch
F: Willow|Redwood|Cherry|Elm|Spruce|Fir|Cedar|Sequoia
U: Ash|Aspen|Cypress|Magnolia|Dogwood|Walnut|Beech|Poplar|Eucalyptus|Hickory
R: Sycamore|Baobab|Juniper|Hemlock|Larch|Yew|Banyan|Mahogany|Teak|Olive|Ginkgo|Cottonwood|Chestnut
V: Linden|Hawthorn|Alder|Rowan|Hornbeam|Catalpa|Tamarack|Sweetgum|Tupelo|Sassafras|Buckeye|Jacaranda|Acacia|Joshua Tree
L: Dragon Blood Tree|Bristlecone Pine|Wollemi Pine|Monkey Puzzle|Rainbow Eucalyptus|Ombu|Quiver Tree|Kapok=ceiba|Boojum|Osage Orange|Ironwood
T: Bamboo|Christmas Tree|Family Tree
""")
add("Name a famous painter", """
C: Leonardo da Vinci=da vinci=leonardo|Vincent van Gogh=van gogh|Pablo Picasso|Michelangelo
F: Claude Monet|Rembrandt|Frida Kahlo|Salvador Dali|Andy Warhol|Bob Ross
U: Georgia O'Keeffe|Jackson Pollock|Raphael|Henri Matisse|Edvard Munch|Johannes Vermeer|Banksy|Edgar Degas|Paul Cezanne|Pierre-Auguste Renoir
R: Gustav Klimt|Rene Magritte|Caravaggio|Sandro Botticelli|Katsushika Hokusai|Diego Rivera|Mark Rothko|Edward Hopper|Wassily Kandinsky|Jean-Michel Basquiat|Keith Haring|Norman Rockwell|Francisco Goya|Titian
V: Hieronymus Bosch|Pieter Bruegel|Paul Gauguin|Joan Miro|Piet Mondrian|Egon Schiele|J.M.W. Turner|Artemisia Gentileschi|El Greco|Roy Lichtenstein|Yayoi Kusama|Georges Seurat|Mary Cassatt|Caspar David Friedrich
L: Hilma af Klint|Remedios Varo|Amrita Sher-Gil|Tamara de Lempicka|Kazimir Malevich|Giorgio de Chirico|Jan van Eyck|Arnold Bocklin|Leonora Carrington|Zdzislaw Beksinski|Utagawa Hiroshige|Akseli Gallen-Kallela|Ilya Repin
""", people=True)
add("Name a fast food chain", """
C: McDonald's|Burger King|Wendy's|Taco Bell|KFC|Subway
F: Chick-fil-A|Domino's|Pizza Hut|Starbucks|Chipotle|Dunkin'=dunkin donuts|Sonic|Popeyes|Arby's
U: In-N-Out|Five Guys|Panda Express|Jack in the Box|Carl's Jr.|Wingstop|Little Caesars|Dairy Queen|Panera|Jimmy John's|Whataburger|Raising Cane's
R: Shake Shack|Culver's|Hardee's|Del Taco|Papa John's|Zaxby's|Bojangles|Checkers|Rally's|White Castle|Church's|Qdoba|El Pollo Loco|Jersey Mike's|Firehouse Subs
V: Krystal|Long John Silver's|A&W|Steak 'n Shake|Wienerschnitzel|Freddy's|Portillo's|Cook Out|Smashburger|The Habit=habit burger
L: Burger Chef|Roy Rogers|Wimpy|Jollibee|Nando's|Pollo Campero|Mos Burger|Lotteria|Runza|Bob's Big Boy|Taco Time
""")
add("Name a car part", """
C: Tire=tires|Engine|Steering Wheel|Brakes=brake|Seat|Door|Wheel
F: Windshield|Battery|Mirror|Headlight|Trunk|Hood|Bumper|Horn
U: Transmission|Radiator|Muffler|Exhaust|Gas Tank|Spark Plug|Seatbelt|Airbag|Windshield Wipers=wipers|Odometer|Speedometer
R: Alternator|Carburetor|Axle|Piston|Clutch|Dashboard|Glove Box|Catalytic Converter|Timing Belt|Gear Shift|Fuel Pump|Suspension|Oil Filter
V: Crankshaft|Camshaft|Differential|Distributor|Starter Motor|Tie Rod|Fender|Hubcap|Strut|Driveshaft|Head Gasket|Throttle Body
L: Harmonic Balancer|Flywheel|Sway Bar|Wastegate|Rocker Arm|Pitman Arm|CV Joint|Oxygen Sensor|Torque Converter|Universal Joint|Heater Core|Idler Pulley
""")
add("Name a type of weather", """
C: Rain|Snow|Sunny=sun|Wind|Cloudy=clouds
F: Thunderstorm=storm|Tornado|Hurricane|Fog|Hail|Lightning
U: Sleet|Drizzle|Blizzard|Heat Wave|Frost|Humidity|Rainbow|Thunder
R: Monsoon|Typhoon|Cyclone|Drought|Freezing Rain|Dust Storm|Mist|Smog|Haze|Flash Flood|Dew
V: Graupel|Derecho|Microburst|Squall|Waterspout|Haboob|Polar Vortex|Virga|Sun Shower|Black Ice|Whiteout|Ice Storm
L: Diamond Dust|Mammatus Clouds|Chinook|Sirocco|Mistral|Foehn|Haar|Bora|Ball Lightning|Fire Whirl|Sundog|Thundersnow|Pyrocumulonimbus|Snow Roller
""")
add("Name something people collect", """
C: Stamps|Coins|Trading Cards=cards=baseball cards=pokemon cards|Rocks
F: Comic Books=comics|Dolls|Action Figures|Vinyl Records=records|Sneakers|Toy Cars|Postcards|Books
U: Funko Pops|Snow Globes|Magnets|Keychains|Pins|Autographs|Legos|Spoons|Teddy Bears|Video Games|Seashells|Bottle Caps
R: Butterflies|Fossils|Watches|Antiques|Matchbooks|Thimbles|Movie Posters|Pressed Pennies|Model Trains|Beanie Babies|Pez Dispensers
V: Meteorites|Sugar Packets|Hotel Soaps|Lunchboxes|Typewriters|Rubber Ducks|Insulators|Barbed Wire|Arrowheads|Cereal Boxes|Airsickness Bags
L: Belly Button Lint|Traffic Cones|Bread Clips|Banana Stickers|Hotel Keycards|Pencil Stubs
T: Dust|Debt|Thoughts
""")
add("Name something you'd find in a hospital", """
C: Doctor|Nurse|Bed|Patient|Wheelchair|Ambulance
F: Stethoscope|Syringe=needle|Medicine|X-ray|Stretcher=gurney|IV=iv drip|Bandage|Thermometer
U: Scalpel|Gloves|Mask|Heart Monitor|Defibrillator|Crutches|Cast|Hospital Gown=gown|Pharmacy|MRI Machine=mri|Oxygen Tank
R: Ventilator|Catheter|Otoscope|Blood Pressure Cuff|Pulse Oximeter|Bedpan|Gauze|Splint|Tourniquet|Incubator|CT Scanner|Crash Cart|Morgue
V: Sphygmomanometer|Ophthalmoscope|Laryngoscope|Nebulizer|Sutures=stitches|Endoscope|Dialysis Machine|Autoclave|Centrifuge|Retractor|Forceps|Tongue Depressor
L: Trocar|Curette|Bougie|Lancet|Rongeur|Hemostat|Pneumatic Tube System|Iron Lung|Stryker Frame|Doppler|Bovie
""")
add("Name an animal found in Australia", """
C: Kangaroo|Koala|Crocodile|Emu
F: Platypus|Wombat|Dingo|Tasmanian Devil|Wallaby|Echidna
U: Cockatoo|Kookaburra|Box Jellyfish|Great White Shark|Dugong|Cassowary|Possum|Sugar Glider|Funnel-web Spider
R: Quokka|Numbat|Bilby|Frilled Lizard|Thorny Devil|Taipan|Lyrebird|Galah|Tree Kangaroo|Quoll|Brown Snake|Redback Spider|Bandicoot
V: Bettong|Potoroo|Pademelon|Little Penguin=fairy penguin|Blue-ringed Octopus|Stonefish|Rainbow Lorikeet|Budgerigar=budgie|Black Swan|Goanna
L: Thylacine=tasmanian tiger|Mala|Kultarr|Dibbler|Mulgara|Leadbeater's Possum|Gouldian Finch|Night Parrot|Mountain Pygmy Possum|Weedy Sea Dragon|Barramundi|Queensland Lungfish=lungfish|Hairy-nosed Wombat
""")
add("Name something that's round", """
C: Ball|Wheel|Coin|Pizza|Clock|Plate
F: Orange|Moon|Sun|Earth|Donut|Cookie|Button|Bagel|Ring
U: Globe|Pancake|Frisbee|Tire|CD|Hula Hoop|Basketball|Bubble|Marble|Lollipop|Polka Dot|Pearl
R: Manhole Cover|Steering Wheel|Doorknob|Tortilla|Bowling Ball|Drum|Hockey Puck|Cymbal|Eyeball|Pupil|Ferris Wheel
V: Washer|Bezel|Porthole|Rose Window|Dartboard|Roundabout|Quoit|Discus|Petri Dish|Wheel of Cheese
L: Tholos|Oculus|Yurt|Rotunda|Ouroboros|Mandala|Torc|Coracle|Cyclotron|Roundel
""")
add("Name an app or social media platform", """
C: Instagram|TikTok|YouTube|Facebook|Snapchat
F: X=twitter|Reddit|Pinterest|LinkedIn|Discord|WhatsApp|Spotify|Netflix
U: Twitch|Threads|Telegram|BeReal|Tumblr|Messenger|Duolingo|Roblox|Uber|Zoom|Google Maps|Venmo
R: Bluesky|Signal|Mastodon|Strava|Quora|Letterboxd|Goodreads|Vimeo|Slack|Notion|Shazam|Waze|Airbnb|Cash App
V: Vine|MySpace|Periscope|Clubhouse|Google+|Path|Yik Yak|Musical.ly|Kik|Ello|Friendster|Flickr|Foursquare
L: Orkut|Xanga|LiveJournal|Hi5|Bebo|Vero|Diaspora|Peach|Meerkat|FriendFeed|Digg|StumbleUpon|Gowalla|Dodgeball
""")
add("Name a candy", """
C: Snickers|M&M's=m&ms=mms|Reese's=reeses|Skittles|Kit Kat|Twix
F: Starburst|Hershey's=hersheys|Sour Patch Kids|Gummy Bears|Jolly Ranchers|Milky Way|Twizzlers|Nerds|Lollipop|Cotton Candy
U: Butterfinger|3 Musketeers=three musketeers|Tootsie Roll|Airheads|Laffy Taffy|Swedish Fish|Warheads|Jelly Beans|Smarties|Candy Corn|Life Savers|Hot Tamales|Mike and Ike|York Peppermint Patty|Almond Joy|Mounds
R: Whoppers|Milk Duds|Junior Mints|Baby Ruth|PayDay|Heath|Rolo|Dots|Good & Plenty|Red Vines|Pop Rocks|Ring Pop|Fun Dip|Gobstopper|Toblerone|Ferrero Rocher
V: Charleston Chew|Necco Wafers|Bit-O-Honey|Mary Jane|Zagnut|Chunky|Sugar Daddy|Abba-Zaba|Big Hunk|Clark Bar|Mallo Cup|Goo Goo Cluster|Valomilk|Astro Pop
L: Turkish Delight|Salmiakki|Halva|Marzipan|Nougat|Konpeito|Brigadeiro|Pastillas|Mazapan|Pocky
""")
add("Name something you can fold", """
C: Paper|Laundry=clothes|Towel|Napkin|Map|Blanket
F: Chair|Table|Letter|Shirt|Pants|Origami|Umbrella|Laptop|Wallet
U: Flip Phone=phone|Arms|Cards|Paper Airplane|Tent|Stroller|Fitted Sheet=sheets|Hand Fan=fan|Murphy Bed|Ironing Board|Pocket Knife
R: Egg Whites|Protein|Flag|Dough|Accordion|Folding Bike|Ladder|Wings|Taco|Burrito|Sail|Glasses
V: Paper Crane|James Webb Telescope|Solar Panel|Tortilla|Pleated Skirt|Napkin Swan|Pop-up Book|Folding Screen|Calzone|Rock Layers
L: Fold Mountains|Cerebral Cortex|Miura-ori|Kirigami|Furoshiki|Byobu
T: A Business|Under Pressure
""")
add("Name something you plug in", """
C: Phone Charger=charger|TV|Lamp|Computer|Toaster
F: Microwave|Refrigerator=fridge|Hair Dryer|Vacuum|Laptop|Blender|Fan|Coffee Maker|Kettle
U: Washing Machine|Dryer|Router|Printer|Game Console|Space Heater|Iron|Electric Toothbrush|Speaker|Air Fryer|Christmas Lights|Headphones
R: Dishwasher|Electric Car|Slow Cooker=crock pot|Rice Cooker|Humidifier|Air Purifier|Curling Iron|Treadmill|Aquarium Pump|Night Light|Power Strip|Sump Pump
V: Dehumidifier|Stand Mixer|Sous Vide|Label Maker|Heating Pad|Bread Machine|Soldering Iron|Kiln|Bug Zapper|Electric Blanket|3D Printer|Waffle Iron|Lava Lamp
L: Theremin|Tesla Coil|Iron Lung|Van de Graaff Generator|Hammond Organ|Oscilloscope|Plasma Ball|Jukebox|Neon Sign
""")
add("Name something that flies", """
C: Bird|Airplane=plane|Helicopter|Butterfly|Kite
F: Bee|Drone|Rocket|Hot Air Balloon|Bat|Mosquito|Fly|Eagle
U: Jet|Blimp|Glider|Paper Airplane|Frisbee|Dragonfly|Parachute|Balloon|Space Shuttle|Owl|Hang Glider
R: Zeppelin|Seaplane|Jetpack|Paraglider|Hummingbird|Moth|Boomerang|Firefly|Satellite
V: Albatross|Gyrocopter|Ornithopter|Tiltrotor=osprey|Dandelion Seed|Maple Seed=helicopter seed|Wingsuit
L: Flying Snake|Draco Lizard|Ekranoplan|Flying Wing|Avrocar|Spruce Goose|Concorde|Ingenuity|Colugo|Samara
T: Flying Squirrel|Flying Fish|Time
""")
add("Name a spice or herb", """
C: Black Pepper=pepper|Garlic|Cinnamon|Basil|Oregano
F: Paprika|Cumin|Ginger|Parsley|Rosemary|Thyme|Chili Powder|Mint|Cilantro
U: Nutmeg|Turmeric|Dill|Bay Leaf|Sage|Cayenne|Vanilla|Curry Powder|Onion Powder|Red Pepper Flakes|Clove|Chives
R: Cardamom|Saffron|Coriander|Fennel Seed|Tarragon|Marjoram|Allspice|Star Anise|Mustard Seed|Garam Masala|Lemongrass|Smoked Paprika|Za'atar
V: Sumac|Fenugreek|Asafoetida=hing|Mace|Juniper Berry|Caraway|Galangal|Epazote|Lovage|Savory|Chervil|Nigella|Annatto|Ras el Hanout
L: Grains of Paradise|Long Pepper|Mahlab|Amchur|Sichuan Pepper|Makrut Lime Leaf|Shiso|Sansho|Kokum|Ajwain|Black Cardamom|Grains of Selim|File Powder|Hyssop|Wattleseed
T: Salt
""")
add("Name a fish", """
C: Salmon|Tuna|Goldfish|Cod|Trout
F: Catfish|Clownfish|Bass|Tilapia|Swordfish|Betta|Piranha|Halibut
U: Mackerel|Sardine|Anchovy|Snapper|Mahi-mahi|Carp|Koi|Pike|Perch|Barracuda|Flounder|Pufferfish|Guppy
R: Sturgeon|Haddock|Grouper|Marlin|Herring|Sole|Walleye|Angelfish|Tetra|Eel|Lionfish|Sailfish|Anglerfish
V: Arapaima|Gar|Bowfin|Hagfish|Coelacanth|Wahoo|Pollock|Turbot|Monkfish|Arowana|Mudskipper|Archerfish|Discus|Oscar
L: Payara|Tigerfish|Hoki|Wolffish|Lumpsucker|Barreleye|Oarfish|Opah|Snakehead|Bichir|Mola|Hogfish|Stargazer|John Dory|Paddlefish|Lungfish
T: Starfish|Jellyfish|Shellfish|Swedish Fish
""")
add("Name a video game console", """
C: PlayStation=ps|Xbox|Nintendo Switch=switch|Wii
F: PlayStation 5=ps5|PlayStation 4=ps4|Xbox Series X|Xbox One|Nintendo DS=ds|Game Boy|Nintendo 64=n64|Steam Deck
U: Xbox 360|PlayStation 2=ps2|PlayStation 3=ps3|GameCube|Nintendo 3DS=3ds|Super Nintendo=snes|NES|Wii U|PSP|Game Boy Advance=gba|Nintendo Switch 2=switch 2
R: Sega Genesis=genesis=mega drive|Atari 2600|Sega Dreamcast=dreamcast|PlayStation Vita=ps vita|Game Boy Color|Sega Saturn|Xbox Series S|Meta Quest=oculus quest|Nintendo DSi
V: Virtual Boy|Atari Jaguar|Neo Geo|TurboGrafx-16|Sega Game Gear|ColecoVision|Intellivision|Magnavox Odyssey|3DO|N-Gage|Ouya|Atari Lynx|Sega CD|32X
L: Vectrex|Fairchild Channel F|Pippin|Amiga CD32|Nuon|WonderSwan|Gizmondo|Tiger Game.com|Philips CD-i=cd-i|Neo Geo Pocket|Atari 7800|Tapwave Zodiac
""")
add("Name a mammal", """
C: Dog|Cat|Elephant|Lion|Horse|Human
F: Tiger|Bear|Monkey|Giraffe|Whale|Dolphin|Mouse|Rabbit|Cow|Zebra
U: Bat|Kangaroo|Gorilla|Hippo=hippopotamus|Rhino=rhinoceros|Deer|Wolf|Fox|Squirrel|Raccoon|Otter|Panda|Cheetah|Camel|Moose|Pig
R: Platypus|Sloth|Armadillo|Hedgehog|Porcupine|Lemur|Hyena|Badger|Skunk|Beaver|Walrus|Orangutan|Meerkat|Chinchilla|Ferret|Bison
V: Pangolin|Aardvark|Okapi|Tapir|Capybara|Wolverine|Manatee|Narwhal|Binturong|Fossa|Kinkajou|Ocelot|Caracal|Mongoose|Dugong|Wombat
L: Aye-aye|Solenodon|Saiga|Tenrec|Colugo|Dik-dik|Gerenuk|Quoll|Olinguito|Zorilla|Babirusa|Hyrax|Pika|Desman|Tarsier|Saola|Numbat
""")
add("Name a reptile or amphibian", """
C: Snake|Lizard|Turtle|Frog|Alligator|Crocodile
F: Toad|Gecko|Iguana|Chameleon|Tortoise|Salamander|Python|Cobra|Rattlesnake
U: Komodo Dragon|Newt|Anaconda|Boa|Bearded Dragon|Gila Monster|Axolotl|Sea Turtle|Garter Snake|Monitor Lizard|Tree Frog|Poison Dart Frog
R: Caiman|Gharial|Skink|Anole|Black Mamba|King Cobra|Viper|Horned Lizard=horned toad|Snapping Turtle|Bullfrog|Caecilian|Leopard Gecko|Copperhead|Cottonmouth|Coral Snake
V: Tuatara|Basilisk Lizard|Thorny Devil|Frilled Lizard|Hellbender|Mudpuppy|Olm|Glass Frog|Goliath Frog|Taipan|Boomslang|Sidewinder|Mata Mata|Leatherback
L: Purple Frog|Hairy Frog|Gaboon Viper|Sunbeam Snake|Shingleback|Surinam Toad|Wonder Gecko|Amphiuma|Siren|Pancake Tortoise|Pig-nosed Turtle|Satanic Leaf-tailed Gecko|Lake Titicaca Frog
""")
add("Name something in a bathroom", """
C: Toilet|Sink|Shower|Bathtub=tub|Mirror|Toilet Paper
F: Towel|Toothbrush|Toothpaste|Soap|Shampoo|Bath Mat|Shower Curtain|Trash Can
U: Plunger|Hairbrush|Comb|Razor|Hair Dryer|Scale|Medicine Cabinet|Conditioner|Floss|Toilet Brush|Lotion|Deodorant|Faucet
R: Loofah|Cotton Swabs=q-tips|Mouthwash|Air Freshener|Exhaust Fan|Towel Rack|Rubber Duck|Bidet|Tweezers|Shower Caddy|Nail Clippers|Tissues|Body Wash|Grout
V: Pumice Stone|Squeegee|Toilet Seat Cover|Bath Bomb|Shower Head|Drain Snake|Washcloth|Grab Bar|Vanity|Toilet Tank|Bath Salts|Bathrobe
L: Flapper|P-trap|Wax Ring|Ballcock|Escutcheon|Toilet Flange|Shower Pan|Overflow Drain|Aerator|Fill Valve|Washlet
""")
add("Name something you do at a party", """
C: Dance|Eat|Talk|Sing|Play Games=games
F: Karaoke|Take Photos|Open Presents|Blow Out Candles|Laugh|Listen to Music|Hug|Cut the Cake
U: Charades|Musical Chairs|Pin the Tail on the Donkey|Pinata|Limbo|Truth or Dare|Make a Toast=toast|Mingle|Play Cards|Make a Wish|Twister|Conga Line
R: Pictionary|Scavenger Hunt|Musical Statues|Hot Potato|Bob for Apples|Photo Booth|Gift Exchange|White Elephant|Murder Mystery|Trivia
V: Mafia=werewolf|Dance-off|Air Guitar|Pass the Parcel|Sardines|Wink Murder|Never Have I Ever|Two Truths and a Lie|Telephone|Lip Sync Battle
L: Hora|Haka|Dabke|Pass the Orange|Egg and Spoon Race|Wassailing|Quadrille|Ceilidh|Electric Slide|Macarena
""")
add("Name an animal with stripes", """
C: Zebra|Tiger|Bee|Skunk
F: Raccoon|Chipmunk|Clownfish|Ring-tailed Lemur=lemur|Wasp|Striped Hyena=hyena
U: Okapi|Badger|Garter Snake|Coral Snake|Tabby Cat|Bongo|Kudu|Striped Bass|Numbat|Angelfish|Lionfish|Yellowjacket
R: Thylacine=tasmanian tiger|Zebra Shark|Zebra Finch|Sea Krait|Moorish Idol|Tiger Shark|Banded Mongoose|Zebra Mussel|Sergeant Major Fish
V: Zorilla|Quagga|Banded Krait|Tiger Moth|Zebra Duiker|Cinnabar Caterpillar|Monarch Caterpillar|Tiger Salamander|Striped Possum|Aardwolf
L: Zebra Pleco|Tiger Barb|Banded Linsang|Zebra Spider|Harlequin Shrimp
""")
add("Name a Greek god or mythological figure", """
C: Zeus|Poseidon|Hades|Athena|Hercules=heracles
F: Apollo|Aphrodite|Ares|Hermes|Artemis|Hera
U: Demeter|Dionysus|Hephaestus|Persephone|Kronos=cronus|Eros|Nike|Gaia|Atlas|Prometheus
R: Hestia|Hecate|Pan|Helios|Selene|Eos|Nyx|Uranus|Rhea|Morpheus|Hypnos|Thanatos|Nemesis|Tyche
V: Iris|Hebe|Asclepius|Themis|Mnemosyne|Hyperion|Oceanus|Tethys|Erebus|Chaos|Aeolus|Triton|Proteus
L: Eileithyia|Harmonia|Deimos|Phobos|Enyo|Nereus|Phorcys|Thalassa|Hemera|Aether|Achlys|Momus|Zelus|Bia|Kratos
""")
add("Name a country in Europe", """
C: France|Germany|Italy|Spain|United Kingdom=uk=britain=great britain|England
F: Greece|Portugal|Ireland|Netherlands=holland|Sweden|Norway|Switzerland|Russia|Poland|Ukraine
U: Belgium|Austria|Denmark|Finland|Iceland|Scotland|Czech Republic=czechia|Hungary|Romania|Turkey
R: Croatia|Serbia|Bulgaria|Slovakia|Slovenia|Wales|Estonia|Latvia|Lithuania|Belarus|Albania|Luxembourg|Monaco|Vatican City=vatican|Malta|Cyprus
V: Bosnia and Herzegovina=bosnia|Montenegro|North Macedonia=macedonia|Kosovo|Northern Ireland
L: Moldova|Andorra|Liechtenstein|San Marino
""")
add("Name a capital city", """
C: Paris|London|Tokyo|Washington, D.C.=washington dc=dc|Rome
F: Beijing|Moscow|Berlin|Madrid|Ottawa|Mexico City|Cairo|Athens|Seoul|New Delhi
U: Canberra|Bangkok|Dublin|Lisbon|Amsterdam|Vienna|Buenos Aires|Brasilia|Nairobi|Stockholm|Oslo|Copenhagen|Havana|Lima|Jakarta|Manila|Hanoi|Tehran|Baghdad|Kyiv=kiev
R: Helsinki|Reykjavik|Prague|Budapest|Warsaw|Bern|Wellington|Santiago|Bogota|Caracas|Ankara|Riyadh|Islamabad|Kabul|Dhaka|Kathmandu|Addis Ababa|Accra|Abuja|Pretoria|Rabat|Doha|Abu Dhabi|Kuala Lumpur|Singapore
V: Ulaanbaatar|Thimphu|Vientiane|Tbilisi|Yerevan|Baku|Tashkent|Astana|Bishkek|Dushanbe|Ashgabat|Montevideo|Asuncion|La Paz|Quito|Tegucigalpa|Managua|Windhoek|Gaborone|Lusaka|Harare|Kigali|Dakar|Bamako|Antananarivo
L: Ngerulmud|Funafuti|Palikir|Tarawa|Majuro|Nuku'alofa|Port Vila|Honiara|Apia|Moroni|Malabo|Gitega|Naypyidaw|Sri Jayawardenepura Kotte|Ouagadougou|Nouakchott|Porto-Novo|Lilongwe|Mbabane|Maseru|Dodoma|Yamoussoukro
""")
add("Name something a pirate has", """
C: Ship|Sword|Treasure|Parrot|Eye Patch|Hat
F: Map|Hook|Peg Leg|Jolly Roger=flag|Cannon|Gold|Spyglass=telescope|Crew
U: Cutlass|Compass|Treasure Chest|Rum|Plank|Bandana|Earring|Beard|Anchor|Skull and Crossbones|Pistol|Captain
R: Doubloons|Pieces of Eight|Flintlock|First Mate|Crow's Nest|Grappling Hook|Bounty|Scurvy|Sea Shanty|Letter of Marque|Black Spot|Quartermaster
V: Galleon|Brig|Sloop|Powder Monkey|Cat o' Nine Tails|Boatswain=bosun|Belaying Pin|Pirate Code|Hardtack|Cabin Boy|Blunderbuss|Tricorn Hat
L: Grog|Boarding Axe|Sextant|Astrolabe|Ditty Bag|Bilge Rat|Fid|Dirk|Chase Gun|Swivel Gun
""")

def norm(s):
    s = s.lower().strip()
    s = re.sub(r"[^\w\s+#*]", "", s)
    s = re.sub(r"^(the|a|an)\s+", "", s)
    return re.sub(r"\s+", " ", s)

out, problems, total = [], [], 0
for i, (prompt, body, people) in enumerate(P, 1):
    answers, seen = [], {}
    for line in body.strip().splitlines():
        key, rest = line.split(":", 1)
        tier = TIERS[key.strip()]
        for item in rest.split("|"):
            parts = [p.strip() for p in item.split("=") if p.strip()]
            text, aliases = parts[0], parts[1:]
            if people and " " in text:
                last = text.split()[-1]
                if len(last) > 3:
                    aliases.append(last)
            keys = [norm(text)] + [norm(a) for a in aliases]
            clean = []
            keys = list(dict.fromkeys(keys))
            for k in keys:
                if k in seen:
                    if k == keys[0]:
                        problems.append(f"{prompt}: duplicate '{text}' ({seen[k]} vs {tier})")
                    continue
                seen[k] = tier
                clean.append(k)
            if not clean or clean[0] != keys[0]:
                continue
            answers.append({"text": text, "aliases": sorted(set(aliases)), "tier": tier})
    total += len(answers)
    out.append({"id": i, "prompt": prompt, "answers": answers})

os.makedirs("data", exist_ok=True)
with open("data/prompts.json", "w") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f"{len(out)} prompts, {total} answers, avg {total/len(out):.0f}/prompt")
for p in problems:
    print("WARN", p)
