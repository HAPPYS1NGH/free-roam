import { Footer } from "./footer/Footer"

// Questions as people asked them, each answered in a line, so every answer
// shows at once instead of hiding behind an accordion.
const questions: [question: string, answer: string][] = [
  ["I use Spotify. Does it work?", "Yes. The desktop app, Free or Premium. No sign-in."],
  ["Do I have to pay for Apple Music?", "Only for songs from Apple's catalog. Songs you own play free."],
  ["What about YouTube Music, or Spotify in Brave?", "Not yet."],
  ["How is this different from Spotify Radio?", "Spotify Radio picks the songs. Free Roam plays yours."],
  ["Why would it want Screen Recording?", "It doesn't need it and never asks. It's an optional effect behind the wheel."],
  ["Is it free?", "Yes, and the code is on GitHub."],
]

// Everything below the station list: the questions and the footer, whose
// billboard leads with the download.
export function Details() {
  return <>
    <section className="p-section p-faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Questions people ask</h2>
      <dl>
        {questions.map(([question, answer]) => <div key={question}><dt>{question}</dt><dd>{answer}</dd></div>)}
      </dl>
    </section>
    <Footer />
  </>
}
