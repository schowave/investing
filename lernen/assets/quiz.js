// Quiz-Baustein. Markup: <div class="quiz" data-answer="B" data-explain="Begründung"><p class="q">…</p><ol><li>…</li></ol></div>
// Antwort anklicken -> sofortige Rückmeldung; bei falscher Wahl bleibt ein zweiter Versuch.
document.querySelectorAll(".quiz").forEach((quiz) => {
  const items = [...quiz.querySelectorAll("li")];
  const answer = "ABCDEFG".indexOf(quiz.dataset.answer);
  const feedback = document.createElement("p");
  feedback.className = "fb";
  quiz.append(feedback);
  items.forEach((li, i) => {
    li.addEventListener("click", () => {
      if (quiz.classList.contains("done")) return;
      if (i === answer) {
        li.classList.add("right");
        quiz.classList.add("done");
        feedback.textContent = "Richtig. " + (quiz.dataset.explain ?? "");
      } else {
        li.classList.add("wrong");
        feedback.textContent = "Nicht ganz. Versuch es noch einmal.";
      }
    });
  });
});
