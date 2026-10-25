const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ofaraxqrpcdiregxjyyb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_wHmQPRNF0WmysskPAcD7yw_6tet5Zyz';

const imagesDir = path.join(__dirname, '..', 'apps', 'web', 'sample_exam_images');

function getBase64Image(filename) {
  const filePath = path.join(imagesDir, filename);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath);
    return `data:image/png;base64,${data.toString('base64')}`;
  }
  return '';
}

const img1 = getBase64Image('circuit_1_ohm_switch.png');
const img2 = getBase64Image('circuit_2_resistor_network.png');
const img3 = getBase64Image('circuit_3_kirchhoff.png');
const img4 = getBase64Image('circuit_4_parallel_wires.png');
const img5 = getBase64Image('circuit_5_v_vs_i_graph.png');
const img6 = getBase64Image('circuit_6_lenz_induction.png');
const img7 = getBase64Image('circuit_7_kirchhoff_essay.png');

console.log('Image lengths:', {
  img1: img1.length,
  img2: img2.length,
  img3: img3.length,
  img4: img4.length,
  img5: img5.length,
  img6: img6.length,
  img7: img7.length
});

const questions = [
  // 10 MCQ Questions
  {
    id: 'phys_q1_mcq',
    type: 'mcq',
    text: 'في الدائرة الكهربية الموضحة بالشكل، عند غلق المفتاح K، ماذا يحدث لقراءة كل من الأميتر A والفولتميتر V؟',
    image_url: img1,
    choices: [
      'تزداد قراءة الأميتر A وتقل قراءة الفولتميتر V',
      'تقل قراءة الأميتر A وتزداد قراءة الفولتميتر V',
      'تزداد قراءة الأميتر A وتزداد قراءة الفولتميتر V',
      'تقل قراءة الأميتر A وتقل قراءة الفولتميتر V'
    ],
    correct_index: 0,
    points: 2,
    explanation: 'عند غلق المفتاح K، تتصل المقاومة R2 على التوازي مع R1 فتقل المقاومة المكافئة للدائرة، وبالتالي تزداد شدة التيار الكلي وتزداد قراءة الأميتر. وبما أن الفولتميتر يقيس فرق الجهد بين قطبي البطارية (V = VB - Ir)، فبزيادة التيار يزداد الهبوط Ir فتقل قراءة الفولتميتر V.'
  },
  {
    id: 'phys_q2_mcq',
    type: 'mcq',
    text: 'من الشكل المقابل، المقاومة المكافئة بين النقطتين (A) و (B) تساوي:',
    image_url: img2,
    choices: [
      '4 Ω',
      '6 Ω',
      '12 Ω',
      '8 Ω'
    ],
    correct_index: 1,
    points: 2,
    explanation: 'المقاومتان 12Ω و 6Ω توازي: (12 × 6) / (12 + 6) = 4Ω. على التوالي مع 2Ω: Req = 4 + 2 = 6Ω.'
  },
  {
    id: 'phys_q3_mcq',
    type: 'mcq',
    text: 'باستخدام قانوني كيرشوف في الدائرة الموضحة بالشكل، احسب شدة التيار المار في المقاومة R3:',
    image_url: img3,
    choices: [
      '1.5 A',
      '2.0 A',
      '0.5 A',
      '3.0 A'
    ],
    correct_index: 1,
    points: 2,
    explanation: 'بتطبيق قانون كيرشوف الأول عند العقدة a: I1 + I2 = I3. بحل معادلات المسارات آنياً نجد أن I3 = 2.0 A.'
  },
  {
    id: 'phys_q4_mcq',
    type: 'mcq',
    text: 'سلكان مستقيمان متوازيان (1) و (2) يمر بهما تياران I1 = 2A و I2 = 4A في نفس الاتجاه. أين تقع نقطة التعادل؟',
    image_url: img4,
    choices: [
      'النقطة Y (في منتصف المسافة بين السلكين)',
      'النقطة X (بين السلكين وأقرب للسلك 1 الأقل تياراً)',
      'النقطة Z (بين السلكين وأقرب للسلك 2)',
      'خارج السلكين بجوار السلك (1)'
    ],
    correct_index: 1,
    points: 2,
    explanation: 'بما أن التيارين في نفس الاتجاه، فنقطة التعادل تقع بين السلكين في منطقة طرح المجالات، وتكون دائماً أقرب إلى السلك ذو التيار الأقل (السلك 1 عند النقطة X).'
  },
  {
    id: 'phys_q5_mcq',
    type: 'mcq',
    text: 'يوضح الرسم البياني المقابل العلاقة بين فرق الجهد V بين قطبي عمود كهربي وشدة التيار I المار في دائرته. تكون القوة الدافعة الكهربية للعمود VB ومقاومته الداخلية r هما:',
    image_url: img5,
    choices: [
      'VB = 12 V ، r = 2 Ω',
      'VB = 6 V ، r = 1 Ω',
      'VB = 12 V ، r = 0.5 Ω',
      'VB = 9 V ، r = 1.5 Ω'
    ],
    correct_index: 0,
    points: 2,
    explanation: 'الجزء المقطوع من محور الجهد يمثل VB = 12 V. والميل يساوي -r = (0 - 12)/(6 - 0) = -2 ومنها r = 2 Ω.'
  },
  {
    id: 'phys_q6_mcq',
    type: 'mcq',
    text: 'في ظاهرة كومتون، عند اصطدام فوتون من أشعة إكس عالية الطاقة بإلكترون حر، فإن الكمية الفيزيائية التي تزداد للفوتون المشتت بعد التصادم هي:',
    image_url: '',
    choices: [
      'تردد الفوتون',
      'الطول الموجي للفوتون',
      'كتلة الفوتون المكافئة',
      'كمية تحرك الفوتون'
    ],
    correct_index: 1,
    points: 2,
    explanation: 'يفقد الفوتون جزءاً من طاقته فتقل طاقته ويقل تردده، وحيث أن الطول الموجي يتناسب عكسياً مع التردد (λ = c/ν)، فإن الطول الموجي للفوتون المشتت يزداد.'
  },
  {
    id: 'phys_q7_mcq',
    type: 'mcq',
    text: 'في الشكل المقابل، عند تقريب القطب الشمالي لمغناطيس من وجه حلقة دائرية بسرعة، يكون اتجاه التيار المستحث في وجه الحلقة المواجه للمغناطيس:',
    image_url: img6,
    choices: [
      'في اتجاه حركة عقارب الساعة ليتكون قطب جنوبي',
      'في عكس اتجاه حركة عقارب الساعة ليتكون قطب شمالي',
      'لا يتولد تيار مستحث لأن الحلقة غير متصلة ببطارية',
      'يتولد تيار مستمر لا يغير اتجاهه'
    ],
    correct_index: 1,
    points: 2,
    explanation: 'تبعاً لقاعدة لينز، عند تقريب قطب شمالي يتكون قطب شمالي معاكس لحدوث تنافر، والقطب الشمالي يناظره تيار في عكس عقارب الساعة.'
  },
  {
    id: 'phys_q8_mcq',
    type: 'mcq',
    text: 'محول كهربي مثالي خافض للجهد النسبة بين عدد لفات ملفيه 4 : 1، وصل ملفه الابتدائي بمصدر تيار متردد جهده 200 V. فإن فرق الجهد بين طرفي ملفه الثانوي يساوي:',
    image_url: '',
    choices: [
      '50 V',
      '800 V',
      '100 V',
      '25 V'
    ],
    correct_index: 0,
    points: 2,
    explanation: 'محول خافض يعني Ns/Np = 1/4. Vs = Vp × (Ns/Np) = 200 × (1/4) = 50 V.'
  },
  {
    id: 'phys_q9_mcq',
    type: 'mcq',
    text: 'عند توصيل الوصلة الثنائية (p-n junction) في الدائرة الكهربية توصيلاً أمامياً (Forward Bias)، فإن سمك منطقة الاستنزاف الفاصلة ومقاومتها:',
    image_url: '',
    choices: [
      'يزداد سمكها وتقل مقاومتها',
      'يقل سمكها وتقل مقاومتها',
      'يزداد سمكها وتزداد مقاومتها',
      'يقل سمكها وتزداد مقاومتها'
    ],
    correct_index: 1,
    points: 2,
    explanation: 'في التوصيل الأمامي، يولد المصدر مجالاً معاكساً للمجال الداخلي لمنطقة الاستنزاف مما يقلل حاجز الجهد وسمك المنطقة الفاصلة فتنخفض المقاومة ويمر التيار.'
  },
  {
    id: 'phys_q10_mcq',
    type: 'mcq',
    text: 'في دائرة تيار متردد RLC متصلة على التوالي، إذا كانت المفاعلة الحثية مساوية للمفاعلة السعوية (XL = XC)، فإن زاوية الطور بين فرق الجهد الكلي والتيار تساوي:',
    image_url: '',
    choices: [
      '90°',
      '0°',
      '45°',
      '180°'
    ],
    correct_index: 1,
    points: 2,
    explanation: 'عندما XL = XC تكون الدائرة في حالة رنين وتكون المعاوقة مساوية للمقاومة الأومية فقط Z = R وتكون زاوية الطور θ = 0°.'
  },

  // 5 Essay Questions
  {
    id: 'phys_q11_essay',
    type: 'essay',
    text: 'في الدائرة الكهربية الموضحة بالشكل المقابل، احسب:\n1) شدة التيار المار في الفرع الأوسط I2.\n2) فرق الجهد بين النقطتين X و Y (V_XY).',
    image_url: img7,
    points: 4,
    lines_count: 6,
    format: 'standard',
    model_answer: '1) بتطبيق كيرشوف الأول عند X: I1 = I2 + I3\n2) بتطبيق كيرشوف الثاني على المسار الأيسر: 18 - 9 = 6*I1 + 3*I2 => 9 = 6*I1 + 3*I2\n3) بالمسار الأيمن: 9 = 3*I2 + 4*I3\n4) بحل المعادلات: I2 = 1.0 A\n5) فرق الجهد V_XY = VB2 + I2*R2 = 9 + (1.0 * 3) = 12 V.'
  },
  {
    id: 'phys_q12_essay',
    type: 'essay',
    text: 'ملف دينامو تيار متردد يتكون من 100 لفة مساحة كل منها 0.02 m² يدور بمعدل 3000 دورة في الدقيقة داخل مجال مغناطيسي منتظم كثافة فيضه 0.1 T. احسب:\n1) القوة الدافعة الكهربية العظمى المستحثة (EMF_max).\n2) القيمة الفعالة للقوة الدافعة الكهربية (EMF_eff).',
    image_url: '',
    points: 4,
    lines_count: 5,
    format: 'standard',
    model_answer: '1) التردد f = 3000 / 60 = 50 Hz. السرعة الزاوية ω = 2 * π * 50 = 314.16 rad/s.\n2) EMF_max = N * B * A * ω = 100 * 0.1 * 0.02 * 314.16 = 62.83 V.\n3) EMF_eff = EMF_max * 0.707 = 62.83 * 0.707 = 44.42 V.'
  },
  {
    id: 'phys_q13_essay',
    type: 'essay',
    text: 'سقط ضوء أحادي اللون تردده ν = 6 × 10^14 Hz على سطح فلز دالة الشغل له Ew = 3.2 × 10^-19 J. (علماً بأن ثابت بلانك h = 6.625 × 10^-34 J.s):\n1) بين هل تنبعث إلكترونات كهروضوئية من السطح أم لا مع التعليل؟\n2) إذا انبعثت، احسب أقصى طاقة حركة (K.E_max) لها.',
    image_url: '',
    points: 4,
    lines_count: 5,
    format: 'standard',
    model_answer: '1) طاقة الفوتون الساقط: E = h * ν = (6.625 × 10^-34) × (6 × 10^14) = 3.975 × 10^-19 J.\nبما أن E > Ew، نعم تنبعث إلكترونات كهروضوئية.\n2) أقصى طاقة حركة: K.E_max = E - Ew = 3.975 × 10^-19 - 3.2 × 10^-19 = 0.775 × 10^-19 J.'
  },
  {
    id: 'phys_q14_essay',
    type: 'essay',
    text: 'جلفانومتر حساس مقاومة ملفه Rg = 50 Ω يقيس تياراً أقصاه Ig = 10 mA. احسب قيمة مقاومة مجزئ التيار (Rs) اللازم توصيلها لتحويله إلى أميتر يقيس تياراً أقصاه 1 A، مع ذكر طريقة توصيلها.',
    image_url: '',
    points: 3,
    lines_count: 4,
    format: 'standard',
    model_answer: '1) قانون مجزئ التيار: Rs = (Ig * Rg) / (I - Ig)\n2) بالتعويض: Rs = (0.01 * 50) / (1 - 0.01) = 0.5 / 0.99 ≈ 0.505 Ω.\n3) طريقة التوصيل: توصل المقاومة على التوازي مع ملف الجلفانومتر.'
  },
  {
    id: 'phys_q15_essay',
    type: 'essay',
    text: 'أجب عما يأتي بوضوح:\n1) علل: يُصنع قلب المحول الكهربي من الحديد المطاوع السيليكوني المقسم إلى شرائح رقيقة معزولة.\n2) اذكر شرطين أساسيين لتكون دائرة تيار متردد RLC في حالة رنين كهربائي.',
    image_url: '',
    points: 3,
    lines_count: 5,
    format: 'standard',
    model_answer: '1) تقسيم القلب إلى شرائح معزولة للحد من التيارات الدوامية وتقليل فقد الطاقة كحرارة، واستخدام الحديد المطاوع السيليكوني لسهولة حركة جزيئاته المغناطيسية.\n2) شرطا الرنين: أن تتساوى المفاعلة الحثية مع السعوية (XL = XC)، وأن يكون تردد الدائرة مساوياً لتردد الرنين f = 1 / (2*π*√(LC)) وتكون المعاوقة Z = R.'
  }
];

function generateStealthModels(qs) {
  const modelA = qs.map((q, idx) => ({ ...q, original_index: idx, model_number: 1 }));
  const modelB = [...qs].reverse().map((q, idx) => ({ ...q, original_index: qs.indexOf(q), model_number: 2 }));
  const evens = qs.filter((_, i) => i % 2 === 0);
  const odds = qs.filter((_, i) => i % 2 !== 0);
  const modelC = [...odds, ...evens].map((q, idx) => ({ ...q, original_index: qs.indexOf(q), model_number: 3 }));
  return { A: modelA, B: modelB, C: modelC };
}

async function upsertInboxQuiz(phone, quizObject) {
  const checkUrl = `${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=eq.${encodeURIComponent(phone)}&select=id`;
  const res = await fetch(checkUrl, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  const existing = await res.json();
  const payload = {
    phone,
    direction: 'outbound',
    message_body: JSON.stringify(quizObject),
    status: quizObject.exam_mode || 'online',
    updated_at: new Date().toISOString()
  };

  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`Updating existing quiz for phone ${phone}...`);
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    console.log(`Update ${phone}:`, updateRes.status);
  } else {
    console.log(`Inserting new quiz for phone ${phone}...`);
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    console.log(`Insert ${phone}:`, insertRes.status);
  }
}

async function main() {
  const groupId = '6c1bc55b-9775-453f-b4b2-d127febc5d92';
  const quizNumber = 5;

  // 1. Online Exam
  const onlineQuiz = {
    id: `quiz-online-${groupId}-${quizNumber}`,
    title: 'امتحان شامل - فيزياء كهربية وحديثة',
    subject: 'الفيزياء للثانوية العامة',
    group_id: groupId,
    quiz_number: quizNumber,
    time_limit_minutes: 45,
    available_date: new Date().toISOString().slice(0, 10),
    start_time: '12:00',
    end_time: '23:59',
    exam_mode: 'online',
    questions: questions,
    created_at: new Date().toISOString()
  };

  await upsertInboxQuiz(`QUIZ_DEF_ONLINE_${groupId}_${quizNumber}`, onlineQuiz);
  await upsertInboxQuiz(`QUIZ_DEF_ONLINE_all_${quizNumber}`, { ...onlineQuiz, id: `quiz-online-all-${quizNumber}`, group_id: 'all' });

  // 2. Paper Exam with Stealth Models
  const paperQuiz = {
    id: `quiz-paper-${groupId}-${quizNumber}`,
    title: 'امتحان شامل - فيزياء كهربية وحديثة (ورقي وبابل شيت)',
    subject: 'الفيزياء للثانوية العامة',
    group_id: groupId,
    quiz_number: quizNumber,
    time_limit_minutes: 45,
    available_date: new Date().toISOString().slice(0, 10),
    exam_mode: 'paper',
    questions: questions,
    stealth_models: generateStealthModels(questions),
    created_at: new Date().toISOString()
  };

  await upsertInboxQuiz(`QUIZ_DEF_PAPER_${groupId}_${quizNumber}`, paperQuiz);
  await upsertInboxQuiz(`QUIZ_DEF_PAPER_all_${quizNumber}`, { ...paperQuiz, id: `quiz-paper-all-${quizNumber}`, group_id: 'all' });

  console.log('✅ Physics exam successfully seeded into Supabase for both Online and Paper modes!');
}

main().catch(err => {
  console.error('Fatal error seeding exam:', err);
  process.exit(1);
});
