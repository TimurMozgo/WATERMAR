function verifyTableConnection() {
  const book = SpreadsheetApp.openById(sheetId());
  console.log('Подключена таблица: ' + book.getName());
  console.log('Листы: ' + book.getSheets().map(s => s.getName()).join(', '));
}
