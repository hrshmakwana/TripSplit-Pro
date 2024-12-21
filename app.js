// Initialize state
let expenses = [];
let participants = [];
let groupExpenses = [];
let monthlyIncome = 0;

// Initialize date inputs with current datetime
document.getElementById('expense-datetime').value = new Date().toISOString().slice(0, 16);

function addParticipant() {
    const name = document.getElementById('participant-name').value.trim();
    if (name && !participants.includes(name)) {
        participants.push(name);
        updateParticipantsList();
        updatePayerDropdown();
        updateSplitMembers();
        document.getElementById('participant-name').value = '';
    }
}

function updateParticipantsList() {
    const list = document.getElementById('participants-list');
    list.innerHTML = '';
    participants.forEach(name => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-gray-700 p-2 rounded-lg';
        div.innerHTML = `
            <span>${name}</span>
            <button onclick="removeParticipant('${name}')" class="text-red-500 hover:text-red-600">
                <i class="bi bi-x-lg"></i>
            </button>
        `;
        list.appendChild(div);
    });
}

function removeParticipant(name) {
    participants = participants.filter(p => p !== name);
    updateParticipantsList();
    updatePayerDropdown();
    updateSplitMembers();
    updateSettlementSummary();
}

function updatePayerDropdown() {
    const select = document.getElementById('payer');
    select.innerHTML = '<option value="">Select payer</option>';
    participants.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
}

function updateSplitMembers() {
    const container = document.getElementById('split-members');
    const payer = document.getElementById('payer').value;
    container.innerHTML = '';
    
    participants
        .filter(name => name !== payer)
        .forEach(name => {
            const div = document.createElement('div');
            div.className = 'flex items-center space-x-2';
            div.innerHTML = `
                <input type="checkbox" id="split-${name}" value="${name}" class="rounded bg-gray-700">
                <label for="split-${name}">${name}</label>
            `;
            container.appendChild(div);
        });
}

// Update split members when payer changes
document.getElementById('payer').addEventListener('change', updateSplitMembers);

document.getElementById('group-expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('group-amount').value);
    const description = document.getElementById('expense-description').value;
    const datetime = document.getElementById('expense-datetime').value;
    const payer = document.getElementById('payer').value;
    const splitBetween = Array.from(document.querySelectorAll('#split-members input:checked')).map(input => input.value);

    if (splitBetween.length > 0) {
        const expense = {
            id: uuid.v4(),
            amount,
            description,
            datetime,
            payer,
            splitBetween,
            perPerson: amount / (splitBetween.length + 1), // Include payer in split
            timestamp: new Date().getTime()
        };

        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<div class="loading mx-auto"></div>';
        submitBtn.disabled = true;

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            groupExpenses.push(expense);
            updateSettlementSummary();
            updateExpenseHistory();
            e.target.reset();
            
            // Reset datetime to current
            document.getElementById('expense-datetime').value = new Date().toISOString().slice(0, 16);
        } catch (error) {
            console.error('Error adding expense:', error);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
});

function updateSettlementSummary() {
    const balances = {};
    participants.forEach(p => balances[p] = 0);

    groupExpenses.forEach(expense => {
        // Add full amount to payer's balance
        balances[expense.payer] += expense.amount;
        
        // Subtract each person's share
        const splitAmount = expense.amount / (expense.splitBetween.length + 1);
        balances[expense.payer] -= splitAmount; // Payer's share
        expense.splitBetween.forEach(person => {
            balances[person] -= splitAmount;
        });
    });

    const summary = document.getElementById('settlement-summary');
    summary.innerHTML = '<div class="space-y-4">';

    // Individual balances
    participants.forEach(person => {
        const balance = balances[person];
        const div = document.createElement('div');
        div.className = `p-3 rounded-lg ${balance > 0 ? 'bg-green-900/50' : balance < 0 ? 'bg-red-900/50' : 'bg-gray-700'}`;
        div.innerHTML = `
            <p class="font-medium">${person}</p>
            <p class="text-sm ${balance > 0 ? 'text-green-400' : balance < 0 ? 'text-red-400' : 'text-gray-400'}">
                ${balance > 0 ? 
                    `Should receive ₹${Math.abs(balance).toFixed(2)}` : 
                    balance < 0 ? 
                    `Needs to pay ₹${Math.abs(balance).toFixed(2)}` : 
                    'All settled up'}
            </p>
        `;
        summary.appendChild(div);
    });

    // Settlement suggestions
    const suggestions = document.createElement('div');
    suggestions.className = 'mt-6 space-y-2';
    suggestions.innerHTML = '<h3 class="font-medium mb-2">Settlement Plan:</h3>';

    // Create settlement plan
    const debtors = participants.filter(p => balances[p] < 0)
        .sort((a, b) => balances[a] - balances[b]);
    const creditors = participants.filter(p => balances[p] > 0)
        .sort((a, b) => balances[b] - balances[a]);

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        const debtAmount = Math.abs(balances[debtor]);
        const creditAmount = balances[creditor];
        const settlementAmount = Math.min(debtAmount, creditAmount);

        if (settlementAmount > 0.01) { // Avoid tiny settlements
            const suggestion = document.createElement('p');
            suggestion.className = 'text-sm bg-gray-700 p-2 rounded';
            suggestion.textContent = `${debtor} needs to pay ₹${settlementAmount.toFixed(2)} to ${creditor}`;
            suggestions.appendChild(suggestion);
        }

        balances[debtor] += settlementAmount;
        balances[creditor] -= settlementAmount;

        if (Math.abs(balances[debtor]) < 0.01) i++;
        if (Math.abs(balances[creditor]) < 0.01) j++;
    }

    summary.appendChild(suggestions);
}

function updateExpenseHistory() {
    const history = document.getElementById('expense-history');
    history.innerHTML = '';

    groupExpenses.sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
        .forEach(expense => {
            const div = document.createElement('div');
            div.className = 'expense-card bg-gray-700 p-4 rounded-lg flex flex-wrap justify-between items-center gap-4';
            div.innerHTML = `
                <div class="flex-1">
                    <h3 class="font-medium">${expense.description}</h3>
                    <p class="text-sm text-gray-400">
                        ${new Date(expense.datetime).toLocaleString()}
                    </p>
                    <p class="text-sm text-gray-400">
                        Paid by: ${expense.payer}
                    </p>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="text-right">
                        <p class="font-bold">₹${expense.amount.toFixed(2)}</p>
                        <p class="text-sm text-gray-400">
                            ₹${expense.perPerson.toFixed(2)} per person
                        </p>
                    </div>
                    <button onclick="deleteGroupExpense('${expense.id}')" class="text-red-500 hover:text-red-600">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <div class="w-full text-sm text-gray-400">
                    Split between: ${[expense.payer, ...expense.splitBetween].join(', ')}
                </div>
            `;
            history.appendChild(div);
        });
}

function deleteGroupExpense(id) {
    groupExpenses = groupExpenses.filter(e => e.id !== id);
    updateSettlementSummary();
    updateExpenseHistory();
}

function switchView(view) {
    document.getElementById('personal-view').classList.toggle('hidden', view !== 'personal');
    document.getElementById('group-view').classList.toggle('hidden', view !== 'group');
}

// Initialize with group view
switchView('group');


// Personal Expense Tracker Functions
document.getElementById('income-input').addEventListener('change', (e) => {
    monthlyIncome = parseFloat(e.target.value) || 0;
    updateBalance();
});

document.getElementById('expense-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const date = document.getElementById('expense-date').value;

    const expense = {
        id: uuid.v4(),
        amount,
        category,
        date,
        timestamp: new Date().getTime()
    };

    expenses.push(expense);
    updateExpenseList();
    updateChart();
    updateBalance();
    e.target.reset();
});

function updateExpenseList() {
    const list = document.getElementById('expense-list');
    list.innerHTML = '';

    expenses.sort((a, b) => b.timestamp - a.timestamp).forEach(expense => {
        const expenseEl = document.createElement('div');
        expenseEl.className = 'expense-card bg-gray-700 p-4 rounded-lg flex justify-between items-center';
        expenseEl.innerHTML = `
            <div>
                <h3 class="font-medium">${expense.category}</h3>
                <p class="text-sm text-gray-400">${new Date(expense.date).toLocaleString()}</p>
            </div>
            <div class="flex items-center space-x-4">
                <span class="font-bold">₹${expense.amount}</span>
                <button onclick="deleteExpense('${expense.id}')" class="text-red-500 hover:text-red-600">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        list.appendChild(expenseEl);
    });
}

function deleteExpense(id) {
    expenses = expenses.filter(e => e.id !== id);
    updateExpenseList();
    updateChart();
    updateBalance();
}

function updateChart() {
    const categories = {};
    expenses.forEach(expense => {
        categories[expense.category] = (categories[expense.category] || 0) + expense.amount;
    });

    expenseChart.data.labels = Object.keys(categories);
    expenseChart.data.datasets[0].data = Object.values(categories);
    expenseChart.update();
}

function updateBalance() {
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const balance = monthlyIncome - totalExpenses;
    document.getElementById('current-balance').textContent = `₹${balance.toFixed(2)}`;
}