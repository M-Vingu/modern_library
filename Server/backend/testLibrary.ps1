# Base URL
$base = "http://localhost:5000/api"

# -----------------------
# 1️⃣ Get all users
# -----------------------
Write-Host "==== Users ===="
$users = Invoke-RestMethod -Method GET -Uri "$base/users"
foreach ($user in $users) {
    Write-Host "User: $($user.name) ID: $($user._id)"
}

# Pick first user for testing
$userId = $users[0]._id

# -----------------------
# 2️⃣ Get all books
# -----------------------
Write-Host "`n==== Books ===="
$books = Invoke-RestMethod -Method GET -Uri "$base/books"
foreach ($book in $books) {
    Write-Host "Book: $($book.title) ID: $($book._id) Copies: $($book.copies) BorrowedBy: $($book.borrowedBy -join ', ')"
}

# -----------------------
# 3️⃣ Borrow books
# -----------------------
foreach ($book in $books) {
    Write-Host "`n--> Borrowing '$($book.title)'"
    $borrowResponse = Invoke-RestMethod -Method POST -Uri "$base/books/borrow/$($book._id)" -ContentType "application/json" -Body (@{ userId = $userId } | ConvertTo-Json)
    Write-Host $borrowResponse.message
}

# -----------------------
# 4️⃣ Attempt to borrow the first book again
# -----------------------
$firstBook = $books[0]
Write-Host "`n--> Attempting to borrow '$($firstBook.title)' again"
$borrowAgainResponse = Invoke-RestMethod -Method POST -Uri "$base/books/borrow/$($firstBook._id)" -ContentType "application/json" -Body (@{ userId = $userId } | ConvertTo-Json)
Write-Host $borrowAgainResponse.message

# -----------------------
# 5️⃣ Return the last book
# -----------------------
$lastBook = $books[-1]
Write-Host "`n--> Returning '$($lastBook.title)'"
$returnResponse = Invoke-RestMethod -Method POST -Uri "$base/books/return/$($lastBook._id)" -ContentType "application/json" -Body (@{ userId = $userId } | ConvertTo-Json)
Write-Host $returnResponse.message

# -----------------------
# 6️⃣ Final book status
# -----------------------
Write-Host "`n==== Books after Borrow/Return ===="
$books = Invoke-RestMethod -Method GET -Uri "$base/books"
foreach ($book in $books) {
    Write-Host "Book: $($book.title) Copies: $($book.copies) BorrowedBy: $($book.borrowedBy -join ', ')"
}