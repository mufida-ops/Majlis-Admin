import type { LessonContent } from "@/content/lessons/types";

/**
 * Grade 3, Volume 1, Units 1-3 -- the remaining lessons beyond Surat
 * al-Humazah (content/lessons/surat-al-humazah.ts), added in Phase 2 to
 * confirm the Safety/Grounding Engine and AI Router generalize across
 * lesson types (surah, hadith, historical/biographical, values), not just
 * the one Phase 1 proved on. All grounding text is human-preparable summary
 * drafted from the licensed textbook (see docs/architecture.md section 2)
 * and is reviewStatus: "draft" pending a human reviewer's approval -- none
 * of this has been reviewed yet.
 *
 * Layer 1 Arabic script is included only where independently verified
 * (short, universally-known verses); elsewhere only transliteration and
 * translation are given, both extracted directly from the source PDF's own
 * clean text -- see the note on RawSource.arabic in content/lessons/types.ts.
 */
export const grade3Vol1Lessons: LessonContent[] = [
  {
    id: "u1l1-honoring-parents",
    title: "Honoring Parents",
    layer1: {
      kind: "quran",
      reference: "Qur'an 17:23 (Surat al-Isra)",
      arabic:
        "وَقَضَىٰ رَبُّكَ أَلَّا تَعْبُدُوا إِلَّا إِيَّاهُ وَبِالْوَالِدَيْنِ إِحْسَانًا ۚ إِمَّا يَبْلُغَنَّ عِندَكَ الْكِبَرَ أَحَدُهُمَا أَوْ كِلَاهُمَا فَلَا تَقُل لَّهُمَا أُفٍّ وَلَا تَنْهَرْهُمَا وَقُل لَّهُمَا قَوْلًا كَرِيمًا",
      transliteration:
        "Wa-qaḍā rabbuka ʾallā taʿbudū ʾillā ʾiyyāhu wa-bi-l-wālidayni ʾiḥsānan ʾimmā yablughanna ʿindaka l-kibara ʾaḥaduhumā ʾaw kilāhumā fa-lā taqul lahumā ʾuffin wa-lā tanharhumā wa-qul lahumā qawlan karīman.",
      translation:
        "And your Lord has decreed that you not worship except Him, and to parents, good treatment. Whether one or both of them reach old age [while] with you, say not to them [so much as], \"uff,\" and do not repel them but speak to them a noble word.",
    },
    layer2: {
      grounding:
        "Lesson on honoring parents (birr al-walidayn). Anchored in Qur'an 17:23: Allah commands worshipping none but Him and treating parents well, never saying so much as 'uff' to them even in old age, but speaking to them with a noble word. Includes the hadith (Muslim) that a person who finds one or both parents in old age and fails to earn Paradise through serving them is disgraced, and the hadith (Tirmidhi) that Allah's pleasure lies in the parents' pleasure. Also draws on the hadith of the companion told by the Prophet to return to his weeping parents and 'make them laugh as you made them cry.' Practical etiquette taught: obeying them, lowering one's voice, using the kindest words, helping them, and praying for their forgiveness and mercy.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 1",
      unitTitle: "My Religion Teaches Me",
      lessonNumber: 1,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 1, Lesson 1, pp. 10-19 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u1l2-etiquette-of-recitation",
    title: "The Etiquette of Recitation",
    layer1: {
      kind: "quran",
      reference: "Qur'an 16:98 (Surat al-Nahl)",
      arabic: "فَإِذَا قَرَأْتَ الْقُرْآنَ فَاسْتَعِذْ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ",
      transliteration: "Fa-ʾidhā qaraʾta l-qurʾāna fa-staʿidh bi-llāhi mina sh-shayṭāni r-rajīmi.",
      translation: "So when you recite the Qur'an, [first] seek refuge with Allah from Satan, the expelled [from His mercy].",
    },
    layer2: {
      grounding:
        "Lesson on the etiquette of reciting the Qur'an: purifying oneself (wudu, using the miswak) before reciting, reciting in a clean quiet place facing the Qiblah, saying the Isti'adhah ('I seek refuge in Allah from the accursed Satan') before beginning and the Basmalah at the start of every surah except Surat al-Tawbah, reciting with a calm and humble heart, reflecting on the meaning of the verses, asking Allah for mercy and Paradise when such verses are recited, avoiding laughing/yawning/needless interruption, and showing respect for the mus'haf (physical copy) by keeping it in a proper place. Cites the hadith (Tirmidhi) that one's rank in Paradise corresponds to the last verse recited, and the example of Salim, the freed slave of Abu Hudhayfah, praised by the Prophet for his beautiful recitation.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 1",
      unitTitle: "My Religion Teaches Me",
      lessonNumber: 2,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 1, Lesson 2, pp. 20-29 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u1l3-revelation-of-the-quran",
    title: "The Revelation of the Qur'an to Prophet Muhammad",
    layer1: {
      kind: "quran",
      reference: "Qur'an 96:1-5 (Surat al-'Alaq, the first verses revealed)",
      arabic: "اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ خَلَقَ الْإِنسَانَ مِنْ عَلَقٍ اقْرَأْ وَرَبُّكَ الْأَكْرَمُ الَّذِي عَلَّمَ بِالْقَلَمِ عَلَّمَ الْإِنسَانَ مَا لَمْ يَعْلَمْ",
      transliteration:
        "Iqraʾ bi-smi rabbika lladhī khalaqa. Khalaqa l-ʾinsāna min ʿalaqin. Iqraʾ wa-rabbuka l-ʾakramu. Alladhī ʿallama bi-l-qalami. ʿAllama l-ʾinsāna mā lam yaʿlam.",
      translation:
        "Recite in the name of your Lord who created - Created man from that which clings. Recite, and your Lord is the most Generous - Who taught by the pen - Taught man that which he knew not.",
    },
    layer2: {
      grounding:
        "The story of the first revelation in the Cave of Hira: the Prophet Muhammad's habit of retreating there to worship and reflect; at age forty, in Ramadan, the Angel Jibreel appearing and commanding 'Iqra' (Read) three times, the Prophet responding 'I cannot read' each time until Jibreel recited the first verses of Surat al-'Alaq (96:1-5); the Prophet returning home trembling, asking his wife Khadijah to cover him, and her reassurance that Allah would never forsake him. Covers the start of prophethood: Allah's later command to proclaim the message beginning with close relatives, the first believers (Khadijah, Abu Bakr al-Siddiq, Ali ibn Abi Talib), opposition from prominent Quraysh figures, and the Prophet's patience and steadfastness in the face of persecution.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 1",
      unitTitle: "My Religion Teaches Me",
      lessonNumber: 3,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 1, Lesson 3, pp. 30-37 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u1l4-surat-al-alaq",
    title: "Surat al-'Alaq",
    layer1: {
      kind: "quran",
      reference: "Qur'an 96:1-19 (Surat al-'Alaq)",
      // Arabic script for the full 19-ayah surah omitted -- only ayat 1-5 are
      // independently verified above (u1l3); a reviewer should supply the
      // verified full-surah Arabic text before this is used for Arabic
      // display or recitation practice.
      transliteration:
        "Iqraʾ bi-smi rabbika lladhī khalaqa (1) Khalaqa l-ʾinsāna min ʿalaqin-i (2) Iqraʾ wa-rabbuka l-ʾakramu (3) Alladhī ʿallama bi-l-qalami (4) ʿAllama l-ʾinsāna mā lam yaʿlam (5) Kallā ʾinna l-ʾinsāna la-yaṭghā (6) ʾAn raʾāhu staghnā (7) ʾInna ʾilā rabbika r-rujʿā (8) ʾA-raʾayta lladhī yanhā (9) ʿAbdan ʾidhā ṣallā (10) ʾA-raʾayta ʾin kāna ʿalā l-hudā (11) ʾAw ʾamara bi-t-taqwā (12) ʾA-raʾayta ʾin kadhdhaba wa-tawallā (13) ʾA-lam yaʿlam bi-ʾanna llāha yarā (14) Kallā la-ʾin lam yantahi la-nasfaʿan bi-n-nāṣiyati (15) Nāṣiyatin kādhibatin khāṭiʾatin (16) Fa-l-yadʿu nādiyahū (17) Sa-nadʿu z-zabāniyata (18) Kallā lā tuṭiʿhu wa-sjud wa-qtarib (19)",
      translation:
        "Recite in the name of your Lord who created - Created man from that which clings. Recite, and your Lord is the most Generous - Who taught by the pen - Taught man that which he knew not. No! [But] indeed, man transgresses. Because he sees himself self-sufficient. Indeed, to your Lord is the return. Have you seen the one who forbids a servant when he prays? Have you seen if he is upon guidance? Or enjoins righteousness? Have you seen if he denies and turns away - Does he not know that Allah sees? No! If he does not desist, We will surely drag him by the forelock - A lying, sinning forelock. Then let him call his associates; We will call the angels of Hell. No! Do not obey him. But prostrate and draw near [to Allah].",
    },
    layer2: {
      grounding:
        "Surat al-'Alaq (96:1-19), the first surah revealed. Themes: Allah as Creator, who created man from a clinging clot and taught by the pen what man did not know; the value of knowledge, reading, and writing; human beings' tendency toward transgression and arrogance when they feel self-sufficient and forget their dependence on Allah; the example of Abu Jahl, who tried to stop the Prophet from praying at the Ka'bah and is warned of being seized by the forelock and dragged to the Fire if he does not desist; the call to prostrate and draw near to Allah through worship, ending the surah on the Prostration of Recitation (Sujud al-Tilawah).",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 1",
      unitTitle: "My Religion Teaches Me",
      lessonNumber: 4,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 1, Lesson 4, pp. 38-45 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u1l5-khadijah-bint-khuwaylid",
    title: "Khadijah bint Khuwaylid",
    layer1: {
      kind: "hadith",
      reference: "Sahih al-Bukhari",
      translation:
        "Never! Rejoice at the glad tidings! By Allah, He will never disgrace you, for by Allah, you keep good relations with your relatives, always tell the truth, help the poor and the destitute, serve your guests generously, and assist those who are stricken with calamities. (Khadijah's words to the Prophet after the first revelation)",
    },
    layer2: {
      grounding:
        "The life of Khadijah bint Khuwaylid (may Allah be pleased with her): a respected, wealthy Qurayshi businesswoman who married the Prophet Muhammad when he was twenty-five and she was forty; the first person to believe in him and accept Islam; mother of his children Al-Qasim, Abdullah, Zainab, Ruqayyah, Umm Kulthum and Fatimah. Covers her support during the earliest, hardest days of revelation -- reassuring him with words recorded in Sahih al-Bukhari -- and her continued material and emotional support of his mission. Notes her death in the 'Year of Sorrow' and the Prophet's enduring love and remembrance of her afterward.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 1",
      unitTitle: "My Religion Teaches Me",
      lessonNumber: 5,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 1, Lesson 5, pp. 46-53 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u1l6-good-character",
    title: "Good Character",
    layer1: {
      kind: "hadith",
      reference: "Jami' al-Tirmidhi",
      translation: "Nothing is heavier [on the scale] in the believer's balance on the Day of Judgment than good character.",
    },
    layer2: {
      grounding:
        "Noble hadith (Tirmidhi): 'Nothing is heavier on the believer's scale on the Day of Judgment than good character.' Teaches that good character (honesty, generosity, respect, cooperation, modesty) outweighs bad deeds (lying, stinginess, mockery, spying, stealing) on the Day of Judgment. Covers practical manners: sincerely apologizing when one has wronged someone, not repeating the same mistake, and following the Prophet's example of gentleness -- he would never repay evil with evil, but would pardon and forgive (citing Qur'an 3:159 on his leniency).",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 1",
      unitTitle: "My Religion Teaches Me",
      lessonNumber: 6,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 1, Lesson 6, pp. 54-59 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u2l1-belief-in-angels",
    title: "Belief in Angels",
    layer1: {
      kind: "quran",
      reference: "Qur'an 35:1 (Surat Fatir)",
      transliteration:
        "Al-ḥamdu li-llāhi fāṭiri s-samāwāti wa-l-ʾarḍi jāʿili l-malāʾikati rusulan ʾulī ʾajniḥatin mathnā wa-thulātha wa-rubāʿa yazīdu fī l-khalqi mā yashāʾu ʾinna llāha ʿalā kulli shayʾin qadīrun.",
      translation:
        "[All] praise is [due] to Allah, Creator of the heavens and the earth, [who] made the angels messengers having wings, two or three or four. He increases in creation what He wills. Indeed, Allah is over all things competent.",
    },
    layer2: {
      grounding:
        "Belief in Angels is one of the six Pillars of Faith. Angels were created from light (hadith, Muslim), do not eat, drink, or sleep, and are in constant obedience to Allah. Names and functions covered: Jibreel (delivers revelation to the Prophets), Israfil (will blow the Trumpet on the Day of Judgment), Ridwan (Keeper of Paradise), Malik (Keeper of Hell), angels who record human deeds, angels who ask forgiveness for believers, angels who attend gatherings of Qur'an recitation and knowledge, and angels who carry the Throne of Allah (Qur'an 69:17, eight of them on the Day of Judgment).",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 2",
      unitTitle: "I am a Devoted Muslim",
      lessonNumber: 1,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 2, Lesson 1, pp. 64-70 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u2l2-surat-al-bayyinah",
    title: "Surat al-Bayyinah",
    layer1: {
      kind: "quran",
      reference: "Qur'an 98:1-8 (Surat al-Bayyinah)",
      transliteration:
        "Lam yakuni lladhīna kafarū min ʾahli l-kitābi wa-l-mushrikīna munfakkīna ḥattā taʾtiyahumu l-bayyinatu (1) Rasūlun mina llāhi yatlū ṣuḥufan muṭahharatan (2) Fīhā kutubun qayyimatun (3) ... Wa-mā ʾumirū ʾillā li-yaʿbudū llāha mukhliṣīna lahu d-dīna ḥunafāʾa wa-yuqīmū ṣ-ṣalāta wa-yuʾtū z-zakāta wa-dhālika dīnu l-qayyimati (5).",
      translation:
        "Those who disbelieved among the People of the Scripture and the polytheists were not to be parted [from misbelief] until there came to them clear evidence - A Messenger from Allah, reciting purified scriptures - Within which are righteous writings ... And they were not commanded except to worship Allah, [being] sincere to Him in religion, inclining to truth, and to establish prayer and to give zakah. And that is the correct religion.",
    },
    layer2: {
      grounding:
        "Surat al-Bayyinah (98:1-8). Theme: the People of the Book and the polytheists remained divided in disbelief until 'the clear proof' (al-bayyinah) came to them -- a Messenger from Allah reciting purified scriptures containing true, upright commands. The core command of every revealed religion is the same: worship Allah alone with sincerity, establish prayer, and give zakat. The surah contrasts outcomes: those who disbelieve among the People of the Book and the polytheists will be in the Fire of Hell eternally, described as 'the worst of creation,' while those who believe and do righteous deeds are 'the best of creation,' rewarded with gardens of eternal residence.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 2",
      unitTitle: "I am a Devoted Muslim",
      lessonNumber: 2,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 2, Lesson 2, pp. 71-79 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u2l3-conditions-and-nullifiers-of-prayer",
    title: "The Conditions and Nullifiers of Prayer",
    layer1: {
      kind: "quran",
      reference: "Qur'an 23:1-2 (Surat al-Mu'minun)",
      transliteration: "Qad ʾaflaḥa l-muʾminūna (1) Alladhīna hum fī ṣalātihim khāshiʿūna (2).",
      translation: "Certainly will the believers succeed - They who are during their prayer humbly submissive.",
    },
    layer2: {
      grounding:
        "The five conditions for a valid prayer: performing ablution (wudu), the entry of the prescribed prayer time, facing the Qiblah, purity of body/clothing/place, and covering the 'awrah (for men, navel to knee; for women, the whole body except face and hands). The nullifiers of prayer (acts that invalidate an ongoing prayer) covered: intentional talking, excessive movement, laughing or giggling, and eating or drinking during the prayer.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 2",
      unitTitle: "I am a Devoted Muslim",
      lessonNumber: 3,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 2, Lesson 3, pp. 80-83 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u2l4-virtues-of-reciting-the-quran",
    title: "The Virtues of Reciting the Holy Qur'an",
    layer1: {
      kind: "hadith",
      reference: "Sahih Muslim (narrated by A'ishah)",
      translation:
        "The one who is proficient in the recitation of the Qur'an will be with the honorable and pure scribes, and he who recites the Qur'an and finds it difficult to recite, while doing his best to recite it, will have a double reward.",
    },
    layer2: {
      grounding:
        "Noble hadith (narrated by A'ishah, Sahih Muslim): 'The one proficient in reciting the Qur'an will be with the honorable, pure scribes (angels); and the one who recites with difficulty, striving his best, will have a double reward.' Encourages perseverance for those who find recitation hard. Enriching background: the Qur'an contains 114 surahs across 30 parts; the first surah is al-Fatihah and the last one revealed is al-Nas; it was compiled into a single mushaf under Abu Bakr al-Siddiq and standardized on one script under Uthman ibn Affan; it was revealed to the Prophet by Jibreel over 23 years, and Allah has promised to preserve it from loss or distortion.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 2",
      unitTitle: "I am a Devoted Muslim",
      lessonNumber: 4,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 2, Lesson 4, pp. 84-89 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u2l5-adhan-and-iqamah",
    title: "The Call to Prayer (Adhan) and the Call for Commencement of Prayer (Iqamah)",
    layer1: {
      kind: "hadith",
      reference: "Sahih al-Bukhari",
      translation:
        "Whoever, after listening to the Adhan, says: 'O Allah, Lord of this perfect call and prayer, grant Muhammad the most exalted and noble rank, and raise him to the lofty station that You have promised him' -- then my intercession shall be released for him on the Day of Judgment.",
    },
    layer2: {
      grounding:
        "Covers the full wording of the Adhan (call marking the entry of prayer time) and the Iqamah (call marking the start of the congregational prayer itself), and the differences between them -- the Iqamah is shorter and adds 'Qad qamati-s-salah' (the prayer has now begun); the Fajr Adhan uniquely adds 'Prayer is better than sleep' after 'Hasten to success.' Sunnah practice: repeating the Muadhin's words silently, except at 'Hasten to prayer / Hasten to success' where one says 'La hawla wa la quwwata illa billah.' Cites the hadith (Bukhari) that whoever says the dua after the Adhan will be granted the Prophet's intercession on the Day of Judgment, and that supplication between the Adhan and Iqamah is not rejected.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 2",
      unitTitle: "I am a Devoted Muslim",
      lessonNumber: 5,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 2, Lesson 5, pp. 90-96 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u2l6-expiators-of-sins",
    title: "The Expiators of Sins",
    layer1: {
      kind: "hadith",
      reference: "Sahih Muslim",
      translation:
        "The five daily prayers, Friday [prayer] to the next Friday [prayer], and the fasting of Ramadan to the next Ramadan, is expiation for the sins committed between them, so long as major sins are avoided.",
    },
    layer2: {
      grounding:
        "Noble hadith (Muslim): 'The five daily prayers, Friday to the next Friday, and the fasting of Ramadan to the next Ramadan, are expiation for the sins committed between them, so long as major sins are avoided.' Additional expiators of sin covered from other cited hadiths: fasting the Day of Arafah (expiates the sins of the preceding and following year), performing Umrah, saying 'Subhan Allahi wa bihamdihi' one hundred times in a day, performing wudu perfectly, and enduring hardship, illness, or sorrow with patience. Emphasizes that Allah is Oft-Forgiving, but major sins require sincere repentance.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 2",
      unitTitle: "I am a Devoted Muslim",
      lessonNumber: 6,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 2, Lesson 6, pp. 97-104 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u3l1-etiquette-of-visiting-and-hospitality",
    title: "The Etiquette of Visiting and Hospitality",
    layer1: {
      kind: "hadith",
      reference: "Jami' al-Tirmidhi",
      translation:
        "There are six things due from the believer to another believer: visiting him when he is ill, attending [his funeral] when he dies, accepting his invitation when he invites, giving him Salam when he meets him, replying to him when he sneezes, and wishing him well when he is absent and when he is present.",
    },
    layer2: {
      grounding:
        "Etiquette for a guest: accept a fellow Muslim's invitation, arrange the visit time in advance, apply perfume and wear appropriate clothing, ask permission at the door (knocking or ringing at most three times, spaced apart), give your name rather than just saying 'it's me,' don't overstay, and ask permission before leaving. Etiquette for a host: welcome guests with a warm face and kind words, seat them well, offer food and drink without extravagance, and walk them to the door when they leave. Cites the hadith (Tirmidhi) on six rights owed between believers and the hadith that honoring one's guest is a sign of faith in Allah and the Last Day. Notes the Emirati custom of greeting guests with 'Hayyakum Allah' and serving Arabic coffee.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 3",
      unitTitle: "Worship Refines my Soul",
      lessonNumber: 1,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 3, Lesson 1, pp. 110-119 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u3l2-fasting",
    title: "Fasting",
    layer1: {
      kind: "quran",
      reference: "Qur'an 2:183 (Surat al-Baqarah)",
      transliteration:
        "Yā-ʾayyuhā lladhīna ʾāmanū kutiba ʿalaykumu ṣ-ṣiyāmu ka-mā kutiba ʿalā lladhīna min qablikum laʿallakum tattaqūna.",
      translation: "O you who have believed, decreed upon you is fasting as it was decreed upon those before you that you may become righteous.",
    },
    layer2: {
      grounding:
        "Fasting (sawm) is defined as abstaining from eating, drinking, and other nullifiers from true dawn to sunset, with the intention to fast made beforehand; it is obligatory on every adult, sane, capable Muslim, and its start is confirmed by sighting the Ramadan crescent. Covers suhoor (the pre-dawn meal, encouraged per hadith) and iftar (the meal breaking the fast). Virtues taught: it teaches patience and mercy toward the poor, Allah forgives sins and multiplies good deeds through it, and the fasting person's dua at the moment of breaking the fast is answered. Etiquette: delaying suhoor, hastening iftar, increased Qur'an recitation, dua, and charity, and avoiding bad speech and deeds.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 3",
      unitTitle: "Worship Refines my Soul",
      lessonNumber: 2,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 3, Lesson 2, pp. 120-127 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u3l4-attributes-of-the-believer",
    title: "The Attributes of the Believer",
    layer1: {
      kind: "hadith",
      reference: "Jami' al-Tirmidhi",
      translation: "The believer is not a defamer, nor a curser, nor vulgar, nor obscene.",
    },
    layer2: {
      grounding:
        "Noble hadith (Tirmidhi): 'The believer is not a defamer (ta'an), nor a curser (la'an), nor vulgar (fahish), nor obscene (badhi').' Teaches guarding one's tongue, saying only what is good or otherwise remaining silent, and not returning insult with insult -- illustrated by a story of a boy who responds to being pushed in a queue with patience rather than anger. Cites Qur'an 68:4 praising the Prophet's 'great moral character' and the hadith that the Prophet himself was never obscene nor given to obscenity.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 3",
      unitTitle: "Worship Refines my Soul",
      lessonNumber: 4,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 3, Lesson 4, pp. 134-141 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u3l5-surat-al-layl",
    title: "Surat al-Layl",
    layer1: {
      kind: "quran",
      reference: "Qur'an 92:1-21 (Surat al-Layl)",
      transliteration:
        "Wa-l-layli ʾidhā yaghshā (1) Wa-n-nahāri ʾidhā tajallā (2) Wa-mā khalaqa dh-dhakara wa-l-ʾunthā (3) ʾInna saʿyakum la-shattā (4) ... Fa-ʾammā man ʾaʿṭā wa-ttaqā (5) wa-ṣaddaqa bi-l-ḥusnā (6) fa-sa-nuyassiruhū li-l-yusrā (7) Wa-ʾammā man bakhila wa-staghnā (8) wa-kadhdhaba bi-l-ḥusnā (9) fa-sa-nuyassiruhū li-l-ʿusrā (10).",
      translation:
        "By the night when it covers, and [by] the day when it appears, and [by] He who created the male and female, indeed, your efforts are diverse. As for he who gives and fears Allah and believes in the best [reward], We will ease him toward ease. But as for he who withholds and considers himself free of need and denies the best [reward], We will ease him toward difficulty.",
    },
    layer2: {
      grounding:
        "Surat al-Layl (92:1-21). Allah swears by the night, the day, and the creation of male and female that human efforts and outcomes differ: those who give in charity, are mindful of Allah, and believe in the reward of the Hereafter, Allah eases toward ease; those who are miserly, consider themselves self-sufficient, and deny the reward, Allah eases toward hardship, and their wealth will not benefit them when they perish. Guidance belongs to Allah, and to Him belong this life and the next. Warns of a blazing Fire for 'the most wretched,' who denied and turned away, while the righteous -- who give from their wealth to purify themselves, seeking only Allah's pleasure -- are kept away from it.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 3",
      unitTitle: "Worship Refines my Soul",
      lessonNumber: 5,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 3, Lesson 5, pp. 142-147 (UAE MOE, 2022-2023)",
    },
  },
  {
    id: "u3l6-tolerance",
    title: "Tolerance",
    layer1: {
      kind: "hadith",
      reference: "Sahih al-Bukhari",
      translation: "Show mercy and you will be shown mercy. Forgive and Allah will forgive you.",
    },
    layer2: {
      grounding:
        "Centers on the Prophet Muhammad's visit to the people of Ta'if after his uncle Abu Talib's death: they mistreated and stoned him, yet when the Angel of the Mountains offered to crush them between two mountains, the Prophet declined, saying he hoped Allah would bring believers from among their descendants. Illustrates tolerance and forgiveness as core Prophetic character. Cites Qur'an 42:40 (the reward of one who forgives and reconciles is with Allah), the hadith (Bukhari) 'Show mercy and you will be shown mercy; forgive and Allah will forgive you,' and Qur'an 3:159 on the Prophet's gentleness. Frames tolerance in the UAE as rooted both in Islamic teaching and in Emirati values associated with Sheikh Zayed.",
      reviewStatus: "draft",
    },
    layer3: {
      grade: 3,
      volume: 1,
      unit: "Unit 3",
      unitTitle: "Worship Refines my Soul",
      lessonNumber: 6,
      sourceRef: "Grade 3 Islamic Education Student Book, Vol 1, Unit 3, Lesson 6, pp. 148-155 (UAE MOE, 2022-2023)",
    },
  },
];
