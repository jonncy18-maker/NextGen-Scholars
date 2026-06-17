import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// ── chevron icon ──────────────────────────────────────────────────────────────
function ChevronIcon({ open }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      aria-hidden="true"
      style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
    >
      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── single accordion item ────────────────────────────────────────────────────
function FAQItem({ q, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ngs-faq-item" data-open={open}>
      <button className="ngs-faq-q" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span>{q}</span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="ngs-faq-a">
          {children}
        </div>
      )}
    </div>
  );
}

// ── section wrapper ──────────────────────────────────────────────────────────
function FAQSection({ title, eyebrow, children }) {
  return (
    <section className="ngs-faq-section">
      <div className="ngs-faq-section-head">
        <div className="ngs-faq-eyebrow">{eyebrow}</div>
        <h2 className="ngs-faq-h2">{title}</h2>
      </div>
      <div className="ngs-faq-list">{children}</div>
    </section>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
export function FAQPage() {
  return (
    <div className="ngs-faq-page">

      {/* ── sticky nav ── */}
      <header className="ngs-faq-nav">
        <div className="ngs-faq-nav-inner">
          <Link to="/" className="ngs-faq-nav-brand">
            <div className="ngs-mark ngs-mark-sm"><span>N</span><span>G</span><span>S</span></div>
            <span className="ngs-faq-nav-name">NextGen Scholars</span>
          </Link>
          <Link to="/" className="ngs-faq-back">← Back to home</Link>
        </div>
      </header>

      {/* ── hero ── */}
      <div className="ngs-faq-hero">
        <div className="ngs-faq-hero-inner">
          <div className="ngs-faq-eyebrow ngs-faq-eyebrow-light">Program Guide</div>
          <h1 className="ngs-faq-title">Frequently Asked<br/><em>Questions</em></h1>
          <p className="ngs-faq-hero-sub">
            Everything scholars and families need to know about the Nursing Generational Scholarship — from program structure to international travel.
          </p>
        </div>
      </div>

      {/* ── content ── */}
      <div className="ngs-faq-body">

        {/* 1 — About the Program */}
        <FAQSection eyebrow="01 — Program Overview" title="About the Program">
          <FAQItem q="What is the Nursing Generational Scholarship?">
            <p>The Nursing Generational Scholarship (NGS) is a privately funded mentorship program that supports Filipino nursing students on a structured pathway from high school through to international nursing licensure and career placement — primarily in the United States or Australia.</p>
            <p>The program covers tuition, school supplies, equipment, travel, and milestone rewards across the full arc of a scholar's training. It is run by a single donor based in the United States with a hands-on mentorship approach.</p>
          </FAQItem>

          <FAQItem q="What is the purpose of this scholarship?">
            <p>The purpose is to lift a family out of generational poverty and give scholars a life of dignity — where potential is never limited by circumstance.</p>
            <p>Each scholar represents proof that transformation is real: that poverty can end with one generation that chooses discipline over despair. The goal is not just to fund an education — it is to rewrite what is possible for a Filipino family.</p>
          </FAQItem>

          <FAQItem q="What is the program's goal?">
            <p>To develop <strong>nurses of the world</strong> — not just by profession, but by mindset and heart. Scholars are trained to think globally and act with compassion: to become competent professionals, responsible citizens, and people of character who carry their Filipino roots while learning to adapt globally.</p>
            <p>The vision is to raise holistic, globally-minded individuals who live with purpose, serve with empathy, and create new paths for others to follow.</p>
          </FAQItem>

          <FAQItem q="What is the mutual promise between mentor and scholar?">
            <ul>
              <li><strong>The mentor's part:</strong> To give opportunity, guidance, and structure.</li>
              <li><strong>The scholar's part:</strong> To honor that opportunity with discipline, integrity, and honesty.</li>
            </ul>
            <p>One generation lifts another.</p>
          </FAQItem>

          <FAQItem q="What are the two tracks?">
            <p><strong>NextGen Nurses (NGN):</strong> A full university nursing pathway (BSN, 4 years) ending in international licensure. Target destination: USA hospital placements or Australian nursing registration (AHPRA).</p>
            <p><strong>NextGen Hospitality (NGH):</strong> A vocational pathway from English fluency to luxury hotel or international cruise placement.</p>
          </FAQItem>
        </FAQSection>

        {/* 2 — Values */}
        <FAQSection eyebrow="02 — Character" title="Program Values">
          <FAQItem q="What values does the program expect from scholars?">
            <p>"How you live matters more than what you achieve." Character is the true measure of success.</p>
            <ul>
              <li><strong>Communication</strong> — Communicate anything important, promptly.</li>
              <li><strong>Honesty</strong> — Tell the truth, even when it's hard.</li>
              <li><strong>Grit</strong> — Keep going even when things are difficult.</li>
              <li><strong>Humility</strong> — Regardless of where you are, never forget where you came from.</li>
              <li><strong>Help Others</strong> — When you become successful, mentor and help the next generation.</li>
            </ul>
          </FAQItem>

          <FAQItem q="What are real examples of what NOT to do?">
            <p>These are real cases from the program's history. Repeating these mistakes ends the scholarship opportunity.</p>
            <ul>
              <li><strong>Case 1 — Lying about school:</strong> A student claimed to be in Grade 12 but was only enrolled in one PE class.</li>
              <li><strong>Case 2 — Lying to get money:</strong> A student asked for funds for "Baking Class" and "Accounting textbooks" — subjects that did not exist.</li>
              <li><strong>Case 3 — Fake report card:</strong> A student submitted another student's report card with the name changed using white ink.</li>
              <li><strong>Case 4 — Dropping out:</strong> A student finished one semester with decent grades, then left school without informing the mentor.</li>
            </ul>
            <p>Integrity is not perfection — it is the courage to stay honest.</p>
          </FAQItem>
        </FAQSection>

        {/* 3 — Requirements */}
        <FAQSection eyebrow="03 — Responsibilities" title="Scholar Requirements">
          <FAQItem q="What are the academic requirements?">
            <ul>
              <li>Grades are accessible online via the university's student portal — they will be reviewed directly from that platform.</li>
              <li>Inform the mentor about upcoming projects and other academic requirements.</li>
              <li>Maintain an average of <strong>85% or higher</strong>.</li>
              <li>If grades drop below 85%, report immediately so solutions can be discussed together — honesty is the most important thing.</li>
            </ul>
          </FAQItem>

          <FAQItem q="How does expense tracking work?">
            <ul>
              <li>Notify the mentor as soon as any school-related expense comes up.</li>
              <li>Send photos of receipts (tuition receipts, uniform, etc.).</li>
              <li>A detailed record of all expenses is maintained, with a summary shared at the end of each semester.</li>
              <li>Tools: <strong>Cebuana Card</strong> for cash use; an <strong>authorized credit card</strong> is available after 2nd year of college.</li>
            </ul>
          </FAQItem>

          <FAQItem q="How should I communicate with the mentor?">
            <ul>
              <li>Send regular updates on academic and personal progress.</li>
              <li>Share your school schedule at the start of each semester.</li>
              <li>Notify the mentor in advance of any important changes — exams, activities, unexpected events.</li>
              <li>Always communicate in English (part of English development).</li>
            </ul>
          </FAQItem>

          <FAQItem q="What does integrity mean in this program?">
            <ul>
              <li>Always be honest about your studies and needs.</li>
              <li>Never hide or delay important updates.</li>
              <li>Integrity is not perfection — it is the courage to stay honest even when it's uncomfortable.</li>
            </ul>
          </FAQItem>
        </FAQSection>

        {/* 4 — Timeline */}
        <FAQSection eyebrow="04 — The Journey" title="Program Timeline">
          <FAQItem q="What happens during the trial period (Grade 11–12)?">
            <p>The trial period covers the final two years of high school (Senior High School / SHS). During this phase:</p>
            <ul>
              <li>Scholar is identified, family is interviewed, and expectations are discussed.</li>
              <li>Small, selective financial support begins — primarily for school essentials.</li>
              <li>Scholar is evaluated for full program entry at the end of Grade 12.</li>
              <li>First reward: a smartphone and phone plan at the start of Grade 11.</li>
            </ul>
          </FAQItem>

          <FAQItem q="What happens in the first year of college?">
            <ul>
              <li>Full scholarship begins — tuition, books, uniforms, supplies, and other academic expenses are covered.</li>
              <li>Mentor check-ins and communication structure are established.</li>
              <li>Mentorship and financial literacy fundamentals begin.</li>
              <li>First domestic travel reward: <strong>Boracay trip</strong> (celebrating high school graduation and start of college).</li>
            </ul>
          </FAQItem>

          <FAQItem q="What changes after the second year of college?">
            <ul>
              <li>Scholar receives access to an <strong>authorized credit card</strong> (connected to the mentor's account) for approved expenses.</li>
              <li>International exposure begins: <strong>Hong Kong / Bangkok trip</strong>.</li>
              <li>Scholar takes on the role of <strong>travel leader</strong>, guiding the group and managing logistics.</li>
            </ul>
          </FAQItem>

          <FAQItem q="What happens after the third year of college?">
            <p>A <strong>Royal Caribbean Cruise</strong> experience — luxury travel from the sea. The scholar leads the experience, reinforcing independence, responsibility, and global exposure.</p>
          </FAQItem>

          <FAQItem q="What happens after college graduation?">
            <ul>
              <li><strong>3-month U.S. Immersion</strong> — a structured cultural and professional immersion across multiple American cities.</li>
              <li>Study for nursing board exams (NCLEX) continues during the immersion.</li>
              <li>Scholar begins mentoring younger students in the program.</li>
            </ul>
          </FAQItem>

          <FAQItem q="What is the long-term career pathway?">
            <ul>
              <li><strong>After 2 years of PH clinical experience:</strong> Begin the 1-year process to immigrate to Australia (AHPRA registration).</li>
              <li><strong>6–7 years after graduation:</strong> Working in Australia as a registered nurse.</li>
              <li>Scholars continue mentoring future program participants throughout their career.</li>
            </ul>
          </FAQItem>
        </FAQSection>

        {/* 5 — Rewards */}
        <FAQSection eyebrow="05 — Milestones" title="Rewards & Milestones">
          <FAQItem q="What rewards do scholars receive throughout the program?">
            <p>Rewards are not gifts — they are milestones that recognize integrity, effort, and growth.</p>
            <ul>
              <li><strong>Starting Grade 11:</strong> Brand-new mid-level smartphone + phone plan.</li>
              <li><strong>Finishing Grade 12:</strong> Chromebook (good quality, brand new).</li>
              <li><strong>Finishing Grade 12:</strong> e-Bike (primarily for college transport — minimize non-school use).</li>
              <li><strong>Finishing 1st year college:</strong> iPhone or Samsung Galaxy (3-year-old model) — for study, work, and daily life.</li>
              <li><strong>Finishing 2nd year college:</strong> iPad or Android tablet (primarily for note-taking and digital drawings).</li>
              <li><strong>Finishing 2nd year college:</strong> Authorized credit card — connected to the mentor's account for travel and approved expenses.</li>
            </ul>
          </FAQItem>

          <FAQItem q="Are rewards guaranteed?">
            <p>Rewards are tied to milestones of integrity and academic performance — not just completion. A scholar who finishes a year but has shown dishonesty, disengagement, or a violation of program values may have a reward withheld or delayed at the mentor's discretion.</p>
          </FAQItem>
        </FAQSection>

        {/* 6 — Travel overview */}
        <FAQSection eyebrow="06 — Adventures" title="Travel Experiences">
          <FAQItem q="What travel experiences are part of the program?">
            <p>Travel is a core part of scholar development — every trip has an educational, cultural, and character-building purpose: respect, courtesy, table manners, and punctuality.</p>
            <ol>
              <li><strong>Boracay</strong> — After 1st year college. Celebrate graduation. Enjoy adventure.</li>
              <li><strong>Bohol</strong> — After 1st year college. Domestic natural beauty and culture.</li>
              <li><strong>Hong Kong / Bangkok</strong> — After 2nd year college. First international trip. Scholar leads the group.</li>
              <li><strong>Royal Caribbean Cruise</strong> — After 3rd year college. Luxury from the sea. Guide the first international cruise experience.</li>
              <li><strong>3-Month U.S. Immersion</strong> — After college graduation. Multi-city cultural and professional development program.</li>
            </ol>
          </FAQItem>

          <FAQItem q="What is the U.S. Immersion?">
            <p>A structured 3-month cultural and professional immersion across multiple American cities and environments. It is designed to transform competence into confidence through real-world exposure.</p>
            <p><strong>Vision:</strong> To gain exposure through real-world immersion, cultural connection, English fluency, and self-leadership across diverse American environments.</p>
            <p><strong>Objectives:</strong></p>
            <ul>
              <li><strong>Cultural Immersion:</strong> Experience the rhythm of everyday American life — from the energy of New York City to the southern charm of Nashville.</li>
              <li><strong>Professional & Personal Growth:</strong> Think, speak, and live in English. Build independence, adaptability, and confidence.</li>
              <li><strong>Leadership & Global Mindset:</strong> Cultivate resilience, adaptability, and purpose — the foundation of future global citizens.</li>
            </ul>
            <p><strong>Expected Outcomes:</strong> Greater adaptability · Deep understanding of American culture · Strengthened independence and initiative · Functional English level B2+ (foundation for OET Grade B) · Greater confidence and self-leadership.</p>
          </FAQItem>

          <FAQItem q="What is the U.S. Immersion itinerary?">
            <ol>
              <li><strong>New York City, NY</strong> — 3 days. Global exposure; first major city on arrival.</li>
              <li><strong>Carmel, IN</strong> — Visit to personal roots; Alexandria, Anderson, Carmel & Fishers; Indianapolis Zoo.</li>
              <li><strong>Chicago, IL</strong> — Architectural discovery; structured big-city experience (weekend).</li>
              <li><strong>Mammoth Cave, KY</strong> — National historic landmark; rural Kentucky life (weekend).</li>
              <li><strong>King's Island, OH</strong> — Theme park; Midwest culture (weekend).</li>
              <li><strong>Nashville, TN</strong> — Southern charm; live country music (weekend).</li>
              <li><strong>Miami, FL + 7-day Caribbean Cruise</strong> — Latin American culture; luxury cruise (week-long).</li>
              <li><strong>Return to Cebu</strong></li>
            </ol>
          </FAQItem>

          <FAQItem q="Do scholars study during the U.S. Immersion?">
            <p>Yes. NCLEX board exam preparation continues throughout the trip:</p>
            <ul>
              <li>6–8 study sessions per week.</li>
              <li>3–4 hours per day of guided self-review and flashcard recall.</li>
              <li>Platform: <strong>CBRC-Hybrid</strong> — video lectures, quizzes, mock exams, mobile app.</li>
              <li>Study environments: hotel room, hotel business center, and local cafés.</li>
              <li>Weekdays focus on study + learning American everyday life; weekends are for travel and experiences.</li>
            </ul>
          </FAQItem>
        </FAQSection>

        {/* 7 — Travel prep */}
        <FAQSection eyebrow="07 — Preparation" title="International Travel Preparation">
          <FAQItem q="What documents do I need before traveling?">
            <ul>
              <li>Valid passport</li>
              <li>Visa stamped in passport (if applicable for destination)</li>
              <li>Boarding pass</li>
              <li>Travel itinerary (flights, hotel, emergency contacts)</li>
              <li>Travel medical insurance (digital or printed)</li>
              <li>Vaccine card (where required)</li>
            </ul>
          </FAQItem>

          <FAQItem q="How does the passport process work?">
            <p>The mentor handles the DFA (Department of Foreign Affairs) application process:</p>
            <ol>
              <li>The mentor fills out the form on the DFA website — you provide your personal information.</li>
              <li>The mentor pays the DFA fee during the application process.</li>
              <li>Appointment is scheduled at <strong>DFA SM Seaside Cebu City</strong> (3F, Mountain Wing, Main).</li>
              <li>Processing and release: usually a <strong>2–3 week wait</strong>.</li>
              <li>Pick up your passport: bring your claim stub and a valid ID to Robinson Galleria.</li>
            </ol>
            <p>Bring both original and photocopies of all documents. Always keep digital copies.</p>
          </FAQItem>

          <FAQItem q="What should I pack?">
            <ul>
              <li>Clothing appropriate for the expected climate</li>
              <li>A light jacket or warm layer for airports and air-conditioned spaces</li>
              <li>Comfortable closed-toe shoes</li>
              <li>Toiletries — check liquid limit: <strong>100 ml per container maximum</strong> in carry-on</li>
              <li>Chargers, power bank, and headphones</li>
              <li>Carry-on luggage weight: <strong>maximum 7 kg</strong></li>
              <li>No sharp objects, scissors, knives, or weapons in carry-on</li>
              <li>No fruits or vegetables (cross-border restrictions)</li>
            </ul>
          </FAQItem>

          <FAQItem q="What is the pre-departure checklist?">
            <p><strong>Documents:</strong> Passports · Visas · Boarding passes · Travel itinerary · Medical insurance</p>
            <p><strong>Finances:</strong> Travel credit card · Download Credit Karma · Confirm budget</p>
            <p><strong>Connectivity:</strong> Activate eSIM (Holafly = unlimited; Airalo = affordable) · Download Google Maps with offline maps · Download Uber/Grab for the country · Charge all devices</p>
            <p><strong>Apps to download:</strong> Google Maps · Uber/Lyft/Grab · Airline app (register flight) · Google Translate (download local language offline) · Credit Karma</p>
            <p><strong>Culture:</strong> Learn basic phrases in the local language · Research the weather · Know what behaviors are rude or illegal in the country · Avoid politics or religion in public</p>
          </FAQItem>

          <FAQItem q="What are the airport basics?">
            <ol>
              <li><strong>Arrive early</strong> — be at the airport 3 hours before international flights.</li>
              <li><strong>Check-in</strong> — find your airline, show passport, visa, and ticket; drop luggage.</li>
              <li><strong>Security</strong> — remove shoes, belt, electronics (tablet, laptop, phone), and liquids for screening.</li>
              <li><strong>Immigration</strong> — present passport, visa, and supporting documents; answer questions honestly.</li>
              <li><strong>Boarding gate</strong> — follow signs, listen for announcements.</li>
              <li><strong>Board</strong> — line up when called, show boarding pass and passport.</li>
            </ol>
            <p>Stay calm, stay organized, and follow each step with confidence.</p>
          </FAQItem>

          <FAQItem q="What is expected of me as a travel leader?">
            <p>After 2nd year college, scholars take on the role of travel leader for the group:</p>
            <ul>
              <li><strong>Plan Ahead:</strong> Review the itinerary and tickets the night before. Always have a Plan B.</li>
              <li><strong>Guide the Group:</strong> Use Google Maps. Be the first to enter trains, cars, or any venue. Set the pace.</li>
              <li><strong>Communicate Early:</strong> Tell the group where you're going and what's next. Keep track of everyone.</li>
              <li><strong>Handle Payments:</strong> Use the credit card only for approved expenses. Take photos of tickets and receipts.</li>
              <li><strong>Stay Calm in Problems:</strong> If something goes wrong, breathe and think. The mentor will be there.</li>
              <li><strong>End of Day Review:</strong> Recap expenses, activities, and plans for tomorrow.</li>
            </ul>
          </FAQItem>
        </FAQSection>

        {/* 8 — Country rules */}
        <FAQSection eyebrow="08 — Destination Guides" title="Country-Specific Rules">
          <FAQItem q="What are the rules in Hong Kong?">
            <p>HK is one of the most developed cities in Asia — rules are strictly enforced.</p>
            <ul>
              <li><strong>No eating or drinking on the MTR or in Ubers</strong> — Fine: ₱15,000 / up to 6 months in prison</li>
              <li><strong>No spitting in public</strong> — Fine: ₱23,000</li>
              <li><strong>No littering</strong> — Fine: ₱23,000 / up to 6 months in prison</li>
              <li><strong>Cross only at pedestrian crossings, only on green</strong> — Fine: ₱38,000 / up to 3 months</li>
              <li><strong>Phone on silent in public</strong> — loud sounds are considered disrespectful</li>
              <li><strong>No doing laundry in the hotel room</strong></li>
            </ul>
            <p><strong>Useful Cantonese:</strong> Hello = <em>néih hóu</em> · Good morning = <em>jóu sàhn</em> · Thank you = <em>dō jeh</em> · Sorry = <em>deoi m̀h jyuh</em> · Where's the bathroom? = <em>juk'sat</em></p>
            <p>Most people in HK speak English — but learning a few words shows respect.</p>
          </FAQItem>

          <FAQItem q="What are the rules in Singapore?">
            <p>Singapore is one of the safest and cleanest countries in Asia. Rules are very strictly enforced and CCTV cameras are everywhere.</p>
            <ul>
              <li><strong>No spitting anywhere</strong> — Fine: ₱225,000 / up to 8 weeks in prison</li>
              <li><strong>No chewing gum (illegal)</strong> — Fine: ₱450,000 / up to 1 year in prison</li>
              <li><strong>No eating on the MRT or in stations</strong> — Fine: up to ₱22,000</li>
              <li><strong>Only dispose of trash in designated bins</strong> — Fine: ₱450,000 / up to 3 months</li>
              <li><strong>No feeding wild animals</strong> — Fine: up to ₱90,000</li>
              <li><strong>No jaywalking</strong> — Fine: ₱90,000 / up to 6 months in prison</li>
              <li><strong>No doing laundry in hotel rooms</strong> — Fine: up to ₱450,000</li>
              <li><strong>Phone on silent</strong> — speaker calls or loud music are culturally disrespectful</li>
            </ul>
            <p>Unlike the Philippines, Singapore will enforce their rules without exception.</p>
          </FAQItem>
        </FAQSection>

        {/* 9 — Finances */}
        <FAQSection eyebrow="09 — Money" title="Financial Guidelines">
          <FAQItem q="How do I manage money abroad?">
            <ul>
              <li>Each country has a different currency — always <strong>convert to Philippine Pesos</strong> before buying anything to understand the real cost.</li>
              <li>Avoid currency exchanges at airports — the exchange rates are the worst there.</li>
              <li>Budget breakdown guide: Food 40% · Transportation 25% · Emergency fund 10% · Souvenirs 10% · Others 15%</li>
            </ul>
            <p><strong>Ways to pay:</strong></p>
            <ul>
              <li><strong>Credit card:</strong> Use for most purchases. Always choose to pay in the <strong>local currency</strong> — never in USD when given the option.</li>
              <li><strong>Cash:</strong> Keep some for small purchases (tips, food stalls, etc.)</li>
              <li><strong>MRT/Train cards:</strong> Singapore uses EZ-Link; Hong Kong uses the Octopus card.</li>
            </ul>
          </FAQItem>

          <FAQItem q="How does the U.S. financial system work?">
            <ul>
              <li>The U.S. relies heavily on digital payments — cards and apps. Always carry a credit card.</li>
              <li><strong>Sales tax:</strong> The price on the shelf is NOT the final price — sales tax adds 6–10% at checkout.</li>
              <li><strong>Tips:</strong> 15–20% is expected at restaurants, salons, and ride services. In tourist areas like Miami, a tip may already be included automatically.</li>
              <li><strong>Payment methods:</strong> Credit/debit card for most things; Apple Pay and tap-to-pay are widely accepted; cash is rarely needed.</li>
            </ul>
          </FAQItem>

          <FAQItem q="How does the authorized credit card work?">
            <ul>
              <li>The credit card is connected to the <strong>mentor's primary account</strong>.</li>
              <li>It works like a short-term loan — the program pays the bill; you are responsible for accuracy and honesty.</li>
              <li>Every transaction is automatically recorded and can be reviewed from the banking app.</li>
              <li>Only the <strong>authorized user</strong> may use the card — do not lend it, photograph it, or allow anyone else to use it.</li>
            </ul>
          </FAQItem>

          <FAQItem q="What can and can't I use the credit card for?">
            <p><strong>Authorized use:</strong></p>
            <ul>
              <li>Food for the group</li>
              <li>Activity tickets and entrance fees</li>
              <li>Transportation</li>
              <li>Group souvenirs</li>
            </ul>
            <p><strong>Prohibited:</strong></p>
            <ul>
              <li>Personal shopping</li>
              <li>Gifts</li>
              <li>Extras outside the approved plan</li>
              <li>Cash advances — this triggers a 20%+ interest charge on the advance</li>
            </ul>
            <p><strong>Expense tracking:</strong> Download <strong>Credit Karma</strong> before traveling. Sync the credit card to the app and use it to track all transactions. If the card is ever lost or blocked, notify the mentor immediately.</p>
          </FAQItem>
        </FAQSection>

        {/* 10 — English & OET */}
        <FAQSection eyebrow="10 — Language" title="English & OET">
          <FAQItem q="Why is English so important in this program?">
            <p>English is not just grammar — it is the tool for freedom, safety, and global success. "From Cebu to the World."</p>
            <ul>
              <li>Communicate and respond in emergencies or in hospitals abroad.</li>
              <li>Handle documents, forms, and interviews with confidence.</li>
              <li>Earn global respect through strong communication skills.</li>
              <li>Navigate professional life in Australia, the U.S., or any English-speaking or international environment.</li>
            </ul>
          </FAQItem>

          <FAQItem q="What is the OET and why does it matter?">
            <p>The <strong>OET (Occupational English Test)</strong> is the preferred English exam for nurses migrating to Australia or the U.S. It is more relevant than IELTS because it is designed specifically for healthcare professionals.</p>
            <p>Australia (AHPRA) and the U.S. (NCLEX/State Boards) accept OET with a <strong>minimum of Grade B</strong> in all sections. It is the highest and most recognized English standard in the international healthcare sector.</p>
            <p>OET preparation begins during the university years and is supported by the mentor throughout.</p>
          </FAQItem>

          <FAQItem q="How should I practice English every day?">
            <ul>
              <li><strong>Listening:</strong> Podcasts or YouTube — 15–30 minutes per day.</li>
              <li><strong>Reading:</strong> Short articles or stories in English.</li>
              <li><strong>Speaking:</strong> During weekly 1-hour calls with the mentor. Daily practice with <strong>ChatGPT Advanced Voice Mode</strong> for English conversation.</li>
              <li><strong>Writing:</strong> Reflections in a daily journal.</li>
            </ul>
            <p>Tip: Using English every day in natural, consistent ways is the most effective path to reaching the required OET level.</p>
          </FAQItem>

          <FAQItem q="What are the English development stages in this program?">
            <p>English development is structured in progressive stages across the program:</p>
            <ul>
              <li><strong>Early stages:</strong> Writing in English in Messenger conversations with the mentor.</li>
              <li><strong>Stage 3:</strong> All mentor communication happens exclusively in English — no Tagalog or Bisaya.</li>
              <li><strong>Summer Bootcamp:</strong> Intensive English practice session required before the U.S. visa interview. Covers travel English, visa interview preparation, medical English, and free conversation.</li>
              <li><strong>OET Prep:</strong> Structured preparation across all four OET skills — Reading, Listening, Writing, Speaking.</li>
            </ul>
          </FAQItem>
        </FAQSection>

      </div>

      {/* ── footer ── */}
      <footer className="ngs-faq-footer">
        <div className="ngs-faq-footer-inner">
          <p>© 2026 NextGen Scholars · Philippines · United States</p>
          <p>Privately funded · No public donations accepted</p>
          <Link to="/" className="ngs-faq-back">← Back to home</Link>
        </div>
      </footer>
    </div>
  );
}
