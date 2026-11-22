export default function FaqSection() {
  return (
    <section className="faq-section" aria-labelledby="faq-heading">
      <h2 id="faq-heading">Image conversion FAQ</h2>
      <details>
        <summary>How do I convert an image?</summary>
        <p>Drop an image into UMBRA or choose a file. Select an output format, start the conversion, then download the result.</p>
      </details>
      <details>
        <summary>Are my images uploaded?</summary>
        <p>UMBRA converts images on your device. The files and converted results stay in this tab during your session. See the <a href="/privacy/">privacy policy</a>.</p>
      </details>
      <details>
        <summary>Can I convert several images at once?</summary>
        <p>Yes. Add your images together, select an output format, and convert the batch.</p>
      </details>
      <details>
        <summary>Which output formats can I use?</summary>
        <p>Common options include JPEG, PNG, and WebP. The format menu shows the options available in your browser.</p>
      </details>
      <details>
        <summary>Can I use UMBRA offline?</summary>
        <p>Once the converter shows “Offline ready,” you can reopen it and convert images without an internet connection.</p>
      </details>
    </section>
  )
}
