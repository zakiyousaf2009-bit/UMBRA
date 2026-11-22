const search = document.querySelector('#error-search')
const results = [...document.querySelectorAll('.error-results article')]
const empty = document.querySelector('#error-empty')

search.closest('.help-search').hidden = false
search.addEventListener('input', () => {
  const query = search.value.trim().toLowerCase()
  for (const result of results) result.hidden = !result.textContent.toLowerCase().includes(query)
  empty.hidden = results.some(result => !result.hidden)
})
