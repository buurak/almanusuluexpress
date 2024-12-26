// Harcama ekleme olayını izle
function trackExpenseAdd(amount) {
    gtag('event', 'add_expense', {
        'event_category': 'Expenses',
        'event_label': 'New Expense',
        'value': amount
    });
}

// Kişi ekleme olayını izle
function trackPersonAdd(name) {
    gtag('event', 'add_person', {
        'event_category': 'People',
        'event_label': name
    });
}

// Harcama detayı görüntüleme
function trackExpenseView(expenseId) {
    gtag('event', 'view_expense', {
        'event_category': 'Expenses',
        'event_label': 'Expense Details',
        'expense_id': expenseId
    });
} 