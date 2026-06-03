// Static list of major Indian cities (ordered alphabetically)
export const INDIAN_CITIES = [
  "Adoni", "Agartala", "Agra", "Ahmedabad", "Ahmednagar", "Aizawl", "Ajmer", "Akola", "Alappuzha", "Aligarh", 
  "Alipurduar", "Allahabad", "Alwar", "Ambala", "Ambattur", "Ambikapur", "Amravati", "Amreli", "Amritsar", 
  "Amroha", "Anand", "Anantapur", "Anantnag", "Arrah", "Asansol", "Aurangabad", "Avadi", "Ayodhya", 
  "Azamgarh", "Badlapur", "Bagaha", "Bagalkot", "Bahadurgarh", "Baharampur", "Bahraich", "Baleshwar", 
  "Ballia", "Bally", "Balurghat", "Banda", "Bangalore", "Bangaon", "Bankura", "Baranagar", "Barasat", 
  "Baraut", "Bardhaman", "Bareilly", "Baripada", "Barmer", "Barrackpore", "Barshi", "Basirhat", 
  "Basti", "Batala", "Bathinda", "Begusarai", "Belgaum", "Bellary", "Bengaluru", "Bettiah", "Betul", 
  "Bhadravati", "Bhadreswar", "Bhagalpur", "Bhagirathpur", "Bhalesa", "Bharatpur", "Bharuch", 
  "Bhatpara", "Bhavnagar", "Bhawanipatna", "Bheemunipatnam", "Bhilai", "Bhilwara", "Bhimavaram", 
  "Bhind", "Bhiwandi", "Bhiwani", "Bhopal", "Bhubaneswar", "Bhuj", "Bhusawal", "Bidar", "Bidhan Nagar", 
  "Bihar Sharif", "Bijapur", "Bikaner", "Bilaspur", "Bobbili", "Bokaro Steel City", "Bongaigaon", 
  "Boral", "Brahmapur", "Budaun", "Bulandshahr", "Bundi", "Burdwan", "Burhanpur", "Buxar", "Calicut", 
  "Chaibasa", "Chakapara", "Chandausi", "Chandigarh", "Chandrapur", "Chapra", "Chas", "Chennai", 
  "Chhalera", "Chhattarpur", "Chhindwara", "Chidambaram", "Chikhli", "Chikkamagaluru", "Chilakaluripet", 
  "Chinsurah", "Chintamani", "Chiplun", "Chirala", "Chittoor", "Chittorgarh", "Churu", "Coimbatore", 
  "Cooch Behar", "Cuddalore", "Cuttack", "Dabgram", "Dadhapatna", "Dahod", "Daltonganj", "Daman", 
  "Damoh", "Darbhanga", "Darjeeling", "Datia", "Davanagere", "Dehradun", "Dehri", "Delhi", "Deoghar", 
  "Deoria", "Dewas", "Dhanbad", "Dhar", "Dharamsala", "Dharmavaram", "Dharmapuri", "Dhaulpur", 
  "Dhenkanal", "Dholka", "Dhoraji", "Dhubri", "Dhule", "Dhuri", "Dibrugarh", "Dimapur", "Dinapur Nizamat", 
  "Dindigul", "Dispur", "Diu", "Doddaballapur", "Dumdum", "Dumka", "Durg", "Durgapur", "Dwarka", 
  "Eluru", "Erode", "Etah", "Etawah", "Faridabad", "Farrukhabad", "Fatehabad", "Fatehpur", "Firozabad", 
  "Firozpur", "Gadag-Betageri", "Gandhidham", "Gandhinagar", "Gangtok", "Ganjam", "Gaya", "Ghatkesar", 
  "Ghaziabad", "Ghazipur", "Giridih", "Godhra", "Gokalpur", "Gola Gokaran Nath", "Gonda", "Gondia", 
  "Gopalpur", "Gorakhpur", "Gudivada", "Gulbarga", "Guna", "Guntakal", "Guntur", "Gurgaon", "Guruvayur", 
  "Guwahati", "Gwalior", "Habra", "Hajipur", "Haldia", "Haldwani", "Hansi", "Hapur", "Hardoi", 
  "Haridwar", "Hassan", "Hathras", "Hazaribagh", "Himatnagar", "Hindupur", "Hinganghat", "Hisar", 
  "Hoshangabad", "Hoshiarpur", "Howrah", "Hubli-Dharwad", "Hugli-Chinsurah", "Hyderabad", "Ichalkaranji", 
  "Ilkal", "Imphal", "Indore", "Irinjalakuda", "Itanagar", "Jabalpur", "Jagadhri", "Jagdalpur", 
  "Jagdevpur", "Jagraon", "Jagtial", "Jaipur", "Jalandhar", "Jalgaon", "Jalna", "Jalpaiguri", 
  "Jamalpur", "Jammu", "Jamnagar", "Jamshedpur", "Jamui", "Jaunpur", "Jehanabad", "Jetpur", "Jhansi", 
  "Jhargram", "Jharsuguda", "Jhunjhunu", "Jind", "Jodhpur", "Jorhat", "Junagadh", "Kadapa", "Kadiri", 
  "Kadi", "Kaithal", "Kakinada", "Kalaburagi", "Kalyan-Dombivli", "Kalyani", "Kamarhati", "Kancheepuram", 
  "Kandla", "Kanhangad", "Kannur", "Kanpur", "Kanyakumari", "Kapadvanj", "Kapurthala", "Karad", 
  "Karaikudi", "Karawal Nagar", "Karimnagar", "Karjat", "Karnal", "Karur", "Karwar", "Kasaragod", 
  "Kashipur", "Katihar", "Katni", "Kavali", "Kavaratti", "Kayamkulam", "Kendrapara", "Kendujhar", 
  "Keshod", "Khagaria", "Khalilabad", "Khammam", "Khandwa", "Khanna", "Kharagpur", "Kharar", 
  "Khardah", "Khargone", "Kheralu", "Khopoli", "Khurja", "Kishangarh", "Kochi", "Kodungallur", 
  "Kohima", "Kolar", "Kolhapur", "Kolkata", "Kollam", "Kopargaon", "Koppal", "Korba", "Kota", 
  "Kotkapura", "Kottayam", "Kovvur", "Kozhikode", "Krishnanagar", "Kulti", "Kumbakonkonam", 
  "Kurnool", "Kurukshetra", "Lachhmangarh", "Lalitpur", "Latur", "Lonavla", "Loni", "Lucknow", 
  "Ludhiana", "Machilipatnam", "Madanapalle", "Madgaon", "Madhyamgram", "Madurai", "Mahad", 
  "Mahbubnagar", "Mahesana", "Maheshtala", "Mahim", "Mahuva", "Mainpuri", "Malappuram", "Malegaon", 
  "Malerkotla", "Malkajgiri", "Malkapur", "Malout", "Mancherial", "Mandla", "Mandsaur", "Mandya", 
  "Mangalore", "Mapusa", "Marmagao", "Mathura", "Maunath Bhanjan", "Mavelikara", "Medinipur", 
  "Meerut", "Mehsana", "Mhaswad", "Mira-Bhayandar", "Miryalaguda", "Mirzapur", "Moga", "Mohali", 
  "Moradabad", "Morbi", "Morena", "Motihari", "Mughalsarai", "Muktsar", "Mumbai", "Munger", 
  "Murshidabad", "Mussoorie", "Muzaffarnagar", "Muzaffarpur", "Mysore", "Nabadwip", "Nabarangapur", 
  "Nadiad", "Nagaon", "Nagapattinam", "Nagda", "Nagercoil", "Nagpur", "Naharalagun", "Naihati", 
  "Najibabad", "Nalasopara", "Nalgonda", "Namakkal", "Nanded", "Nandurbar", "Nandyal", "Nangloi Jat", 
  "Narasaraopet", "Narnaul", "Narsinghpur", "Nashik", "Navi Mumbai", "Navsari", "Nawada", "Nawanshahr", 
  "Nedumangad", "Nellore", "New Delhi", "Neyveli", "Nileshwaram", "Nizamabad", "Noida", "North Barrackpur", 
  "North Dumdum", "Nandyal", "Ongole", "Orai", "Osmanabad", "Ooty", "Palakkad", "Palanpur", "Palghar", 
  "Pali", "Palwal", "Palwancha", "Panaji", "Panchkula", "Pandharpur", "Panihati", "Panipat", 
  "Panna", "Panvel", "Paradeep", "Paramakudi", "Parbhani", "Patan", "Pathanamthitta", "Pathankot", 
  "Patiala", "Patna", "Patratu", "Pattukkottai", "Payyannur", "Pithampur", "Pilibhit", "Pimpri-Chinchwad", 
  "Pithoragarh", "Pollachi", "Pondicherry", "Ponnani", "Porbandar", "Port Blair", "Proddatur", 
  "Puducherry", "Pudukkottai", "Pune", "Puri", "Purnia", "Purulia", "Pusad", "Quilon", "Radhanpur", 
  "Rae Bareli", "Raichur", "Raiganj", "Raigarh", "Raipur", "Rajahmundry", "Rajkot", "Rajnandgaon", 
  "Rajouri", "Rajpura", "Ramachandrapuram", "Ramagundam", "Ramanagaram", "Ramanathapuram", 
  "Ramgarh", "Rampur", "Ranaghat", "Ranchi", "Ranibennur", "Raniganj", "Ratlam", "Ratnagiri", 
  "Raurkela", "Ravulapalem", "Rayachoti", "Rayadurg", "Rohtak", "Roorkee", "Rourkela", "Rudrapur", 
  "Sagar", "Saharanpur", "Saharsa", "Salem", "Samastipur", "Sambalpur", "Sambhal", "Sangareddy", 
  "Sangli", "Sangrur", "Sankarankovil", "Santipur", "Sarangarh", "Sasaram", "Satara", "Satna", 
  "Sattenapalle", "Sehore", "Seoni", "Serampore", "Shahabad", "Shahdol", "Shahjahanpur", "Shajapur", 
  "Shamli", "Shikohabad", "Shillong", "Shimla", "Shimoga", "Shivpuri", "Shoranur", "Shrirampur", 
  "Siddipet", "Sidhpur", "Sikar", "Silchar", "Siliguri", "Silvassa", "Singrauli", "Sini", "Sirkali", 
  "Sirsa", "Sirsi", "Sitamarhi", "Sitapur", "Sivakasi", "Siwan", "Solan", "Solapur", "Sonepat", 
  "Sopore", "Srikakulam", "Srinagar", "Srivilliputhur", "Sujangarh", "Sultanpur", "Sunabeda", 
  "Surat", "Surendranagar", "Suryapet", "Tadepalligudem", "Tadpatri", "Talasari", "Talcher", 
  "Tambaram", "Tamluk", "Tarn Taran", "Tenali", "Tezpur", "Thalassery", "Thane", "Thanjavur", 
  "Thiruvananthapuram", "Thiruvarur", "Thodupuzha", "Thoothukudi", "Thrissur", "Tindivanam", 
  "Tinsukia", "Tiptur", "Tiruchirappalli", "Tiruelveli", "Tirupati", "Tirupur", "Tirur", 
  "Tiruvalla", "Tiruvannamalai", "Tiruvallur", "Tiruvarur", "Tohana", "Tonk", "Tumkur", "Tuni", 
  "Tuticorin", "Udaipur", "Udgir", "Udhampur", "Udupi", "Ujjain", "Ulhasnagar", "Uluberia", 
  "Unnao", "Unjha", "Upleta", "Uran", "Uravakonda", "Vadodara", "Valparai", "Valsad", 
  "Vandavasi", "Vapi", "Varanasi", "Vasai-Virar", "Vasco da Gama", "Vellore", "Veraval", 
  "Vidisha", "Vijayawada", "Vikarabad", "Viluppuram", "Virar", "Virudhachalam", "Virudhunagar", 
  "Visakhapatnam", "Visnagar", "Vizianagaram", "Vrindavan", "Vyara", "Wadhwan", "Wai", 
  "Warangal", "Wardha", "Washim", "Wayanad", "Yamunanagar", "Yavatmal", "Yelahanka", "Yellandu", 
  "Yemmiganur", "Yerraguntla", "Zirakpur"
];

/**
 * Normalizes a city name by trimming whitespace and capitalizing the first letter of each word.
 * Examples:
 *   "  patna " -> "Patna"
 *   "NEW DELHI" -> "New Delhi"
 *   "kalyan-dombivli" -> "Kalyan-Dombivli"
 */
export function normalizeCityName(city: string): string {
  if (!city) return "";
  return city
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s|-)\S/g, (match) => match.toUpperCase());
}

/**
 * Matches a search query against the static list of Indian cities.
 */
export function searchStaticCities(query: string): string[] {
  if (!query) return [];
  const normalizedQuery = query.toLowerCase().trim();
  if (normalizedQuery.length === 0) return [];
  
  return INDIAN_CITIES.filter(city => 
    city.toLowerCase().includes(normalizedQuery)
  );
}
