/**
 * Province identity (D101; art from `docs/design/Dozari - 18 Provinces`): every city belongs to one of these, and the
 * app themes the player's home with its badge, colours, souvenir and local greeting. The 31 provinces of Iran plus
 * seven abroad cities with a large Iranian community, and a generic `abroad` entry for every other city outside Iran.
 * Names and greetings are content (like city names), not UI copy. `shape` keys the landmark drawing on the client.
 */
export interface Province {
  key: string;
  nameFa: string;
  /** Two-letter mark on the avatar ring. */
  abbr: string;
  shape: string;
  /** Badge sky gradient, top → bottom. */
  sky: readonly [string, string];
  ground: string;
  ring: string;
  /** Item-pack icon key of the souvenir. */
  gift: string;
  giftFa: string;
  hello: string;
  landmark: string;
  /** Province key of the friendly rival («جنگ استان‌ها»). */
  rival: string;
  abroad: boolean;
}

export const PROVINCES: readonly Province[] = [
  { key: 'tehran', nameFa: 'تهران', abbr: 'ته', shape: 'azadi', sky: ['#8FDCFA', '#C9E8FF'], ground: '#C8B8A8', ring: '#3FC1F0', gift: 'bread', giftFa: 'نان سنگک', hello: 'سلام تهرونی!', landmark: 'برج آزادی', rival: 'alborz', abroad: false },
  { key: 'isfahan', nameFa: 'اصفهان', abbr: 'اص', shape: 'mosqueBlue', sky: ['#3FC1F0', '#BFEFFF'], ground: '#E8C88A', ring: '#3FC1F0', gift: 'gift', giftFa: 'گز', hello: 'سلام اصفهانی!', landmark: 'نقش جهان', rival: 'fars', abroad: false },
  { key: 'fars', nameFa: 'فارس', abbr: 'فا', shape: 'pillars', sky: ['#FFAA7A', '#FFE48A'], ground: '#E8C88A', ring: '#FF7A3D', gift: 'gift', giftFa: 'بهارنارنج', hello: 'سلام شیرازی!', landmark: 'تخت جمشید', rival: 'isfahan', abroad: false },
  { key: 'khrazavi', nameFa: 'خراسان رضوی', abbr: 'خر', shape: 'gold', sky: ['#8FDCFA', '#E6F7FF'], ground: '#C8B8A8', ring: '#FFC93C', gift: 'saffron', giftFa: 'زعفران', hello: 'سلام مشهدی!', landmark: 'حرم امام رضا', rival: 'tehran', abroad: false },
  { key: 'azsharghi', nameFa: 'آذربایجان شرقی', abbr: 'آش', shape: 'bridge', sky: ['#C9A3FF', '#F0E0FF'], ground: '#C8B8A8', ring: '#A66BF0', gift: 'rug', giftFa: 'فرش تبریز', hello: 'سلام تبریزی!', landmark: 'بازار تبریز', rival: 'azgharbi', abroad: false },
  { key: 'azgharbi', nameFa: 'آذربایجان غربی', abbr: 'آغ', shape: 'castle', sky: ['#FFB3C9', '#FFE6EE'], ground: '#C8B8A8', ring: '#FF8FB6', gift: 'gift', giftFa: 'سیب ارومیه', hello: 'سلام ارومیه‌ای!', landmark: 'قلعهٔ ارومیه', rival: 'azsharghi', abroad: false },
  { key: 'ardabil', nameFa: 'اردبیل', abbr: 'ار', shape: 'mount', sky: ['#8FDCFA', '#E6F7FF'], ground: '#7ED957', ring: '#3FC1F0', gift: 'jug', giftFa: 'عسل سبلان', hello: 'سلام اردبیلی!', landmark: 'کوه سبلان', rival: 'gilan', abroad: false },
  { key: 'gilan', nameFa: 'گیلان', abbr: 'گی', shape: 'forest', sky: ['#B8F08F', '#E6F7D6'], ground: '#5FB84A', ring: '#7ED957', gift: 'teaGlass', giftFa: 'چای لاهیجان', hello: 'سلام گیلانی!', landmark: 'جنگل‌های شمال', rival: 'mazandaran', abroad: false },
  { key: 'mazandaran', nameFa: 'مازندران', abbr: 'ما', shape: 'seaforest', sky: ['#8FDCFA', '#D6F4FF'], ground: '#5FB84A', ring: '#3FA36B', gift: 'spiceSack', giftFa: 'برنج', hello: 'سلام مازنی!', landmark: 'دریا و جنگل', rival: 'gilan', abroad: false },
  { key: 'golestan', nameFa: 'گلستان', abbr: 'گل', shape: 'cone', sky: ['#FFE48A', '#FFF6D8'], ground: '#7ED957', ring: '#E8A01A', gift: 'gift', giftFa: 'ماهی', hello: 'سلام گلستانی!', landmark: 'گنبد قابوس', rival: 'khshomali', abroad: false },
  { key: 'semnan', nameFa: 'سمنان', abbr: 'سم', shape: 'desert', sky: ['#FFC9A3', '#FFEBD6'], ground: '#FFC93C', ring: '#E8743B', gift: 'bread', giftFa: 'قطاب', hello: 'سلام سمنانی!', landmark: 'کویر', rival: 'tehran', abroad: false },
  { key: 'yazd', nameFa: 'یزد', abbr: 'یز', shape: 'wind', sky: ['#FFC9A3', '#FFEBD6'], ground: '#E8C88A', ring: '#D9A06A', gift: 'pashmak', giftFa: 'پشمک', hello: 'سلام یزدی!', landmark: 'بادگیرهای یزد', rival: 'kerman', abroad: false },
  { key: 'kerman', nameFa: 'کرمان', abbr: 'کر', shape: 'castle', sky: ['#FFAA7A', '#FFE0C8'], ground: '#E8C88A', ring: '#C47A2A', gift: 'pistachio', giftFa: 'پسته', hello: 'سلام کرمونی!', landmark: 'ارگ بم', rival: 'yazd', abroad: false },
  { key: 'qom', nameFa: 'قم', abbr: 'قم', shape: 'dome', sky: ['#8FDCFA', '#E6F7FF'], ground: '#C8B8A8', ring: '#FFC93C', gift: 'sohan', giftFa: 'سوهان', hello: 'سلام قمی!', landmark: 'حرم حضرت معصومه', rival: 'markazi', abroad: false },
  { key: 'markazi', nameFa: 'مرکزی', abbr: 'مر', shape: 'dome', sky: ['#C9A3FF', '#F0E0FF'], ground: '#C8B8A8', ring: '#7E46D6', gift: 'pomegranate', giftFa: 'انار ساوه', hello: 'سلام اراکی!', landmark: 'بازار اراک', rival: 'qom', abroad: false },
  { key: 'qazvin', nameFa: 'قزوین', abbr: 'قز', shape: 'gate', sky: ['#FFB3C9', '#FFE6EE'], ground: '#C8B8A8', ring: '#FF4D8D', gift: 'sohan', giftFa: 'باقلوا', hello: 'سلام قزوینی!', landmark: 'عالی‌قاپو', rival: 'zanjan', abroad: false },
  { key: 'zanjan', nameFa: 'زنجان', abbr: 'زن', shape: 'dome', sky: ['#8FDCFA', '#E6F7FF'], ground: '#C8B8A8', ring: '#3FA36B', gift: 'gift', giftFa: 'چاقو', hello: 'سلام زنجانی!', landmark: 'گنبد سلطانیه', rival: 'qazvin', abroad: false },
  { key: 'hamadan', nameFa: 'همدان', abbr: 'هم', shape: 'rock', sky: ['#B8F08F', '#E6F7D6'], ground: '#7ED957', ring: '#8E8E9E', gift: 'jug', giftFa: 'سفال لالجین', hello: 'سلام همدانی!', landmark: 'گنجنامه', rival: 'kermanshah', abroad: false },
  { key: 'kermanshah', nameFa: 'کرمانشاه', abbr: 'کش', shape: 'rock', sky: ['#FFE48A', '#FFF6D8'], ground: '#7ED957', ring: '#B8A898', gift: 'bread', giftFa: 'نان برنجی', hello: 'سلام کرمانشاهی!', landmark: 'طاق بستان', rival: 'hamadan', abroad: false },
  { key: 'kurdistan', nameFa: 'کردستان', abbr: 'کد', shape: 'mount', sky: ['#B8F08F', '#E6F7D6'], ground: '#5FB84A', ring: '#3FA36B', gift: 'gift', giftFa: 'دف', hello: 'سلام سنندجی!', landmark: 'کوه‌های کردستان', rival: 'kermanshah', abroad: false },
  { key: 'lorestan', nameFa: 'لرستان', abbr: 'لر', shape: 'castle', sky: ['#B8F08F', '#E6F7D6'], ground: '#7ED957', ring: '#D9A06A', gift: 'pistachio', giftFa: 'گردو', hello: 'سلام لرستانی!', landmark: 'فلک‌الافلاک', rival: 'ilam', abroad: false },
  { key: 'ilam', nameFa: 'ایلام', abbr: 'ای', shape: 'mount', sky: ['#FFC9A3', '#FFEBD6'], ground: '#7ED957', ring: '#C47A2A', gift: 'gift', giftFa: 'سبد حصیری', hello: 'سلام ایلامی!', landmark: 'کبیرکوه', rival: 'lorestan', abroad: false },
  { key: 'khuzestan', nameFa: 'خوزستان', abbr: 'خو', shape: 'river', sky: ['#FFC93C', '#FFF4B0'], ground: '#E8C88A', ring: '#E8A01A', gift: 'gift', giftFa: 'خرما', hello: 'سلام اهوازی!', landmark: 'پل سفید اهواز', rival: 'bushehr', abroad: false },
  { key: 'bushehr', nameFa: 'بوشهر', abbr: 'بو', shape: 'bay', sky: ['#8FDCFA', '#D6F4FF'], ground: '#E8C88A', ring: '#D9A06A', gift: 'gift', giftFa: 'ماهی', hello: 'سلام بوشهری!', landmark: 'ساحل بوشهر', rival: 'hormozgan', abroad: false },
  { key: 'hormozgan', nameFa: 'هرمزگان', abbr: 'هر', shape: 'sea', sky: ['#FF8FB6', '#FFD6E4'], ground: '#E8C88A', ring: '#FF4D8D', gift: 'gift', giftFa: 'لیمو عمانی', hello: 'سلام بندری!', landmark: 'جزیرهٔ هرمز', rival: 'bushehr', abroad: false },
  { key: 'sistan', nameFa: 'سیستان و بلوچستان', abbr: 'سب', shape: 'desert', sky: ['#FFAA7A', '#FFE0C8'], ground: '#FFC93C', ring: '#E8743B', gift: 'rug', giftFa: 'سوزن‌دوزی', hello: 'سلام بلوچی!', landmark: 'کوه خواجه', rival: 'kerman', abroad: false },
  { key: 'khjonubi', nameFa: 'خراسان جنوبی', abbr: 'خج', shape: 'castle', sky: ['#FFE48A', '#FFF6D8'], ground: '#E8C88A', ring: '#C48A0E', gift: 'pomegranate', giftFa: 'زرشک', hello: 'سلام بیرجندی!', landmark: 'ارگ بیرجند', rival: 'khrazavi', abroad: false },
  { key: 'khshomali', nameFa: 'خراسان شمالی', abbr: 'خش', shape: 'mount', sky: ['#C9A3FF', '#F0E0FF'], ground: '#7ED957', ring: '#7E46D6', gift: 'watermelon', giftFa: 'خربزه', hello: 'سلام بجنوردی!', landmark: 'کوه‌های آلاداغ', rival: 'golestan', abroad: false },
  { key: 'chaharmahal', nameFa: 'چهارمحال و بختیاری', abbr: 'چب', shape: 'fall', sky: ['#8FDCFA', '#E6F7FF'], ground: '#7ED957', ring: '#5A8A6A', gift: 'gift', giftFa: 'لبنیات محلی', hello: 'سلام بختیاری!', landmark: 'آبشار و کوهرنگ', rival: 'kohgiluyeh', abroad: false },
  { key: 'kohgiluyeh', nameFa: 'کهگیلویه و بویراحمد', abbr: 'کب', shape: 'fall', sky: ['#B8F08F', '#E6F7D6'], ground: '#5FB84A', ring: '#8E5A2A', gift: 'gift', giftFa: 'قارچ کوهی', hello: 'سلام یاسوجی!', landmark: 'آبشار یاسوج', rival: 'chaharmahal', abroad: false },
  { key: 'alborz', nameFa: 'البرز', abbr: 'ال', shape: 'mount', sky: ['#FFB3C9', '#FFE6EE'], ground: '#7ED957', ring: '#A66BF0', gift: 'gift', giftFa: 'هلو', hello: 'سلام کرجی!', landmark: 'کوه‌های البرز', rival: 'tehran', abroad: false },
  { key: 'istanbul', nameFa: 'استانبول', abbr: 'IS', shape: 'mosqueBlue', sky: ['#FFAA7A', '#FFE0C8'], ground: '#C8B8A8', ring: '#C4302B', gift: 'teaGlass', giftFa: 'چای ترکی', hello: 'سلام استانبولی!', landmark: 'ایاصوفیه', rival: 'dubai', abroad: true },
  { key: 'dubai', nameFa: 'دبی', abbr: 'DX', shape: 'burj', sky: ['#FFC93C', '#FFF4B0'], ground: '#E8C88A', ring: '#3FC1F0', gift: 'gift', giftFa: 'خرما', hello: 'سلام دبیایی!', landmark: 'برج خلیفه', rival: 'istanbul', abroad: true },
  { key: 'toronto', nameFa: 'تورنتو', abbr: 'TO', shape: 'cn', sky: ['#8FDCFA', '#E6F7FF'], ground: '#C8D8E8', ring: '#C4302B', gift: 'jug', giftFa: 'شربت افرا', hello: 'سلام تورنتویی!', landmark: 'برج سی‌ان', rival: 'la', abroad: true },
  { key: 'la', nameFa: 'لس‌آنجلس', abbr: 'LA', shape: 'hills', sky: ['#FF8FB6', '#FFD6E4'], ground: '#E8C88A', ring: '#E8A01A', gift: 'gift', giftFa: 'پرتقال', hello: 'سلام تهرانجلسی!', landmark: 'نخل‌ها و تپه‌ها', rival: 'toronto', abroad: true },
  { key: 'london', nameFa: 'لندن', abbr: 'LN', shape: 'clock', sky: ['#C8D8E8', '#EEF3F8'], ground: '#7ED957', ring: '#2F5FB8', gift: 'teaGlass', giftFa: 'چای', hello: 'سلام لندنی!', landmark: 'ساعت بیگ‌بن', rival: 'paris', abroad: true },
  { key: 'paris', nameFa: 'پاریس', abbr: 'PA', shape: 'eiffel', sky: ['#FFB3C9', '#FFE6EE'], ground: '#7ED957', ring: '#8E8E9E', gift: 'bread', giftFa: 'نان باگت', hello: 'سلام پاریسی!', landmark: 'برج ایفل', rival: 'london', abroad: true },
  { key: 'berlin', nameFa: 'برلین', abbr: 'BE', shape: 'gate', sky: ['#C9A3FF', '#F0E0FF'], ground: '#C8B8A8', ring: '#C9A3FF', gift: 'bread', giftFa: 'پرتزل', hello: 'سلام برلینی!', landmark: 'دروازهٔ براندنبورگ', rival: 'london', abroad: true },
  { key: 'abroad', nameFa: 'خارج از کشور', abbr: 'IR', shape: 'globe', sky: ['#8FDCFA', '#E6F7FF'], ground: '#7ED957', ring: '#3FC1F0', gift: 'teaGlass', giftFa: 'چای وطن', hello: 'سلام هم‌وطن!', landmark: 'دور از خونه', rival: 'abroad', abroad: true },
];

const BY_KEY = new Map(PROVINCES.map((p) => [p.key, p]));

/** The province of a key from `cities.province`, or null for unknown keys and the Iran-wide «شهر دیگر». */
export const provinceOf = (key: string | null | undefined): Province | null => (key ? BY_KEY.get(key) ?? null : null);
