const STORAGE_KEY = "FINANCE_MANAGER_MAX_V2";

let db = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {

    transactions: [],

    budgets: [],

    goals: [],

    recurring: [],

    loans: [],

    accounts: [
        {
            id: 1,
            name: "Cash",
            type: "Cash"
        }
    ],

    premium: false,

    theme: "dark"
};


let transactionFilter = "all";

let moneyChart = null;
let categoryChart = null;


/* ================= BASIC ================= */

function save(){

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(db)
    );

    renderEverything();
}


function money(value){

    return "₹" + Number(value || 0)
        .toLocaleString("en-IN", {
            maximumFractionDigits: 2
        });

}


function today(){

    return new Date()
        .toISOString()
        .split("T")[0];

}


function escapeHTML(value){

    return String(value ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}


function toast(message){

    const box =
        document.getElementById("toast");

    box.textContent = message;

    box.classList.add("show");

    setTimeout(()=>{
        box.classList.remove("show");
    },2200);

}


/* ================= NAVIGATION ================= */

function showPage(page, button){

    document
        .querySelectorAll(".page")
        .forEach(p=>{
            p.classList.remove("active");
        });

    const target =
        document.getElementById("page-"+page);

    if(target){
        target.classList.add("active");
    }


    document
        .querySelectorAll(".nav-btn")
        .forEach(b=>{
            b.classList.remove("active");
        });


    if(button){

        button.classList.add("active");

    }else{

        const buttons =
            document.querySelectorAll(".nav-btn");

        const map = {
            home:0,
            transactions:1,
            budgets:2,
            insights:3,
            settings:4
        };

        if(buttons[map[page]])
            buttons[map[page]].classList.add("active");

    }


    window.scrollTo({
        top:0,
        behavior:"smooth"
    });

}


function toggleTheme(){

    db.theme =
        db.theme === "dark"
        ? "light"
        : "dark";

    applyTheme();

    save();

}


function applyTheme(){

    document.body.classList.toggle(
        "light",
        db.theme === "light"
    );

}


/* ================= TOTALS ================= */

function totals(){

    let income = 0;
    let expense = 0;

    db.transactions.forEach(t=>{

        if(t.type === "income")
            income += Number(t.amount);

        if(t.type === "expense")
            expense += Number(t.amount);

    });


    return {

        income,

        expense,

        balance: income - expense,

        savings: income - expense

    };

}


/* ================= HOME ================= */

function renderHome(){

    const t = totals();

    document.getElementById("homeBalance")
        .textContent = money(t.balance);

    document.getElementById("homeIncome")
        .textContent = money(t.income);

    document.getElementById("homeExpense")
        .textContent = money(t.expense);

    document.getElementById("homeSavings")
        .textContent = money(t.savings);

    document.getElementById("homeTransactionCount")
        .textContent = db.transactions.length;


    const totalBudget =
        db.budgets.reduce(
            (sum,b)=>sum+Number(b.amount),
            0
        );


    const spent =
        db.budgets.reduce((sum,b)=>{

            return sum +

                db.transactions
                .filter(t =>
                    t.type === "expense" &&
                    t.category === b.category
                )
                .reduce(
                    (s,t)=>s+Number(t.amount),
                    0
                );

        },0);


    const percent =
        totalBudget
        ? Math.round(spent / totalBudget * 100)
        : 0;


    document.getElementById("budgetUsed")
        .textContent = percent + "%";


    renderHomeTransactions();

    renderUpcoming();

}


function renderHomeTransactions(){

    const box =
        document.getElementById("homeTransactions");


    const transactions =
        [...db.transactions]
        .sort((a,b)=>b.created-a.created)
        .slice(0,5);


    if(!transactions.length){

        box.innerHTML = `
            <div class="empty">
                No transactions yet.<br>
                Add your first income or expense.
            </div>
        `;

        return;

    }


    box.innerHTML =
        transactions.map(transactionHTML).join("");

}


function transactionHTML(t){

    const icon =
        t.type === "income"
        ? "↑"
        : t.type === "transfer"
        ? "⇄"
        : "↓";


    const sign =
        t.type === "income"
        ? "+"
        : "-";


    const color =
        t.type === "income"
        ? "positive"
        : "negative";


    return `

        <div class="transaction">

            <div class="tx-icon">
                ${icon}
            </div>

            <div class="tx-info">

                <strong>
                    ${escapeHTML(t.title)}
                </strong>

                <small>
                    ${escapeHTML(t.category || "Other")}
                    •
                    ${t.date}
                    •
                    ${escapeHTML(t.account || "")}
                </small>

            </div>


            <div class="tx-amount ${color}">

                ${sign}${money(t.amount)}

                <br>

                <button
                    class="delete-btn"
                    onclick="deleteTransaction(${t.id})">
                    DELETE
                </button>

            </div>

        </div>

    `;

}


function renderUpcoming(){

    const box =
        document.getElementById("homeUpcoming");


    const list =
        [...db.recurring]
        .sort((a,b)=>
            a.nextDate.localeCompare(b.nextDate)
        )
        .slice(0,4);


    if(!list.length){

        box.innerHTML = `
            <div class="empty">
                No upcoming recurring payments.
            </div>
        `;

        return;

    }


    box.innerHTML =
        list.map(r=>`

        <div class="transaction">

            <div class="tx-icon">
                ↻
            </div>

            <div class="tx-info">

                <strong>
                    ${escapeHTML(r.name)}
                </strong>

                <small>
                    ${r.nextDate}
                    •
                    ${escapeHTML(r.category)}
                </small>

            </div>

            <div class="tx-amount negative">
                -${money(r.amount)}
            </div>

        </div>

        `).join("");

}


/* ================= TRANSACTIONS ================= */

function changeTransactionFilter(filter,button){

    transactionFilter = filter;

    document
        .querySelectorAll(".filter-tabs button")
        .forEach(b=>b.classList.remove("active"));

    button.classList.add("active");

    renderTransactions();

}


function renderTransactions(){

    const box =
        document.getElementById("transactionList");


    const search =
        (
            document
            .getElementById("transactionSearch")
            ?.value || ""
        ).toLowerCase();


    let list =
        [...db.transactions]
        .sort((a,b)=>b.created-a.created);


    if(transactionFilter !== "all"){

        list =
            list.filter(
                t=>t.type === transactionFilter
            );

    }


    if(search){

        list =
            list.filter(t=>

                t.title
                    .toLowerCase()
                    .includes(search)

                ||

                (t.category || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (t.notes || "")
                    .toLowerCase()
                    .includes(search)

            );

    }


    const income =
        list
        .filter(t=>t.type==="income")
        .reduce((s,t)=>s+Number(t.amount),0);


    const expense =
        list
        .filter(t=>t.type==="expense")
        .reduce((s,t)=>s+Number(t.amount),0);


    document.getElementById("recordCount")
        .textContent = list.length;

    document.getElementById("transactionIncome")
        .textContent = money(income);

    document.getElementById("transactionExpense")
        .textContent = money(expense);


    if(!list.length){

        box.innerHTML = `
            <div class="empty">
                No transactions found.
            </div>
        `;

        return;

    }


    box.innerHTML =
        list.map(transactionHTML).join("");

}


function deleteTransaction(id){

    if(!confirm("Delete this transaction?"))
        return;


    db.transactions =
        db.transactions.filter(
            t=>t.id !== id
        );


    save();

    toast("Transaction deleted");

}


/* ================= ADD TRANSACTION ================= */

function openTransaction(type){

    const categories = [
        "Food",
        "Shopping",
        "Transport",
        "Bills",
        "Entertainment",
        "Education",
        "Health",
        "Travel",
        "Salary",
        "Investment",
        "Other"
    ];


    document.getElementById("modalContent").innerHTML = `

        <h2>
            Add ${type==="income"?"Income":"Expense"}
        </h2>

        <div class="form">

            <label>DESCRIPTION</label>

            <input
                id="txTitle"
                placeholder="e.g. Grocery shopping">


            <label>AMOUNT</label>

            <input
                id="txAmount"
                type="number"
                min="0"
                placeholder="₹0">


            <label>CATEGORY</label>

            <select id="txCategory">

                ${categories.map(c=>
                    `<option>${c}</option>`
                ).join("")}

            </select>


            <label>DATE</label>

            <input
                id="txDate"
                type="date"
                value="${today()}">


            <label>ACCOUNT</label>

            <select id="txAccount">

                ${db.accounts.map(a=>
                    `<option>
                        ${escapeHTML(a.name)}
                    </option>`
                ).join("")}

            </select>


            <label>NOTE</label>

            <input
                id="txNotes"
                placeholder="Optional note">


            <button
                onclick="addTransaction('${type}')">

                SAVE TRANSACTION

            </button>

        </div>

    `;


    openModal();

}


function addTransaction(type){

    const title =
        document.getElementById("txTitle")
        .value.trim();


    const amount =
        Number(
            document.getElementById("txAmount")
            .value
        );


    if(!title || amount <= 0){

        toast("Enter a valid title and amount");

        return;

    }


    db.transactions.push({

        id:Date.now(),

        created:Date.now(),

        title,

        amount,

        category:
            document.getElementById("txCategory").value,

        date:
            document.getElementById("txDate").value,

        account:
            document.getElementById("txAccount").value,

        notes:
            document.getElementById("txNotes").value,

        type

    });


    closeModal();

    save();

    toast("Transaction saved");

}


/* ================= TRANSFER ================= */

function openTransfer(){

    document.getElementById("modalContent").innerHTML = `

        <h2>Transfer Money</h2>

        <div class="form">

            <label>AMOUNT</label>

            <input
                id="transferAmount"
                type="number"
                placeholder="₹0">


            <label>FROM</label>

            <select id="fromAccount">

                ${db.accounts.map(a=>
                    `<option>${escapeHTML(a.name)}</option>`
                ).join("")}

            </select>


            <label>TO</label>

            <select id="toAccount">

                ${db.accounts.map(a=>
                    `<option>${escapeHTML(a.name)}</option>`
                ).join("")}

            </select>


            <button onclick="makeTransfer()">
                RECORD TRANSFER
            </button>

        </div>

    `;

    openModal();

}


function makeTransfer(){

    const amount =
        Number(
            document.getElementById("transferAmount").value
        );

    const from =
        document.getElementById("fromAccount").value;

    const to =
        document.getElementById("toAccount").value;


    if(amount<=0 || from===to){

        toast("Check transfer details");

        return;

    }


    const id=Date.now();


    db.transactions.push({

        id,

        created:id,

        title:`Transfer ${from} → ${to}`,

        amount,

        category:"Transfer",

        date:today(),

        account:from,

        type:"transfer",

        notes:`To ${to}`

    });


    closeModal();

    save();

    toast("Transfer recorded");

}


/* ================= BUDGETS ================= */

function openBudget(){

    const categories=[
        "Food",
        "Shopping",
        "Transport",
        "Bills",
        "Entertainment",
        "Education",
        "Health",
        "Travel",
        "Other"
    ];


    document.getElementById("modalContent").innerHTML = `

        <h2>Create Budget</h2>

        <div class="form">

            <label>CATEGORY</label>

            <select id="budgetCategory">

                ${categories.map(c=>
                    `<option>${c}</option>`
                ).join("")}

            </select>


            <label>MONTHLY LIMIT</label>

            <input
                id="budgetAmount"
                type="number"
                placeholder="₹0">


            <button onclick="addBudget()">
                CREATE BUDGET
            </button>

        </div>

    `;

    openModal();

}


function addBudget(){

    const category =
        document.getElementById("budgetCategory").value;

    const amount =
        Number(
            document.getElementById("budgetAmount").value
        );


    if(amount<=0){

        toast("Enter a valid budget");

        return;

    }


    db.budgets.push({

        id:Date.now(),

        category,

        amount

    });


    closeModal();

    save();

    toast("Budget created");

}


function renderBudgets(){

    const box =
        document.getElementById("budgetList");


    const total =
        db.budgets.reduce(
            (s,b)=>s+Number(b.amount),
            0
        );


    const spent =
        db.budgets.reduce((sum,b)=>{

            return sum +

            db.transactions

            .filter(t=>
                t.type==="expense" &&
                t.category===b.category
            )

            .reduce(
                (s,t)=>s+Number(t.amount),
                0
            );

        },0);


    document.getElementById("totalBudget")
        .textContent = money(total);

    document.getElementById("totalBudgetSpent")
        .textContent = money(spent);

    document.getElementById("budgetRemaining")
        .textContent = money(total-spent);


    if(!db.budgets.length){

        box.innerHTML=`
            <div class="empty">
                No budgets created yet.
            </div>
        `;

        renderGoals();

        return;

    }


    box.innerHTML =
        db.budgets.map(b=>{

            const used =
                db.transactions

                .filter(t=>
                    t.type==="expense" &&
                    t.category===b.category
                )

                .reduce(
                    (s,t)=>s+Number(t.amount),
                    0
                );


            const percent =
                Math.min(
                    100,
                    Math.round(
                        used / b.amount * 100
                    )
                );


            return `

                <div class="budget-card">

                    <div class="budget-title">

                        <strong>
                            ${escapeHTML(b.category)}
                        </strong>

                        <span>
                            ${money(used)}
                            /
                            ${money(b.amount)}
                        </span>

                    </div>


                    <div class="progress">

                        <div
                            style="width:${percent}%">
                        </div>

                    </div>


                    <small
                        style="color:${percent>=100?'var(--red)':'var(--muted)'}">

                        ${percent}% used

                    </small>


                    <button
                        onclick="deleteBudget(${b.id})"
                        class="delete-btn"
                        style="float:right">

                        DELETE

                    </button>

                </div>

            `;

        }).join("");


    renderGoals();

}


function deleteBudget(id){

    db.budgets =
        db.budgets.filter(
            b=>b.id!==id
        );

    save();

}


/* ================= GOALS ================= */

function openGoal(){

    document.getElementById("modalContent").innerHTML = `

        <h2>Savings Goal</h2>

        <div class="form">

            <label>GOAL NAME</label>

            <input
                id="goalName"
                placeholder="New laptop">


            <label>TARGET AMOUNT</label>

            <input
                id="goalTarget"
                type="number"
                placeholder="₹0">


            <label>ALREADY SAVED</label>

            <input
                id="goalSaved"
                type="number"
                placeholder="₹0">


            <button onclick="addGoal()">
                CREATE GOAL
            </button>

        </div>

    `;

    openModal();

}


function addGoal(){

    const name =
        document.getElementById("goalName")
        .value.trim();

    const target =
        Number(
            document.getElementById("goalTarget").value
        );

    const saved =
        Number(
            document.getElementById("goalSaved").value
        ) || 0;


    if(!name || target<=0){

        toast("Enter valid goal details");

        return;

    }


    db.goals.push({

        id:Date.now(),

        name,

        target,

        saved

    });


    closeModal();

    save();

    toast("Goal created");

}


function renderGoals(){

    const box =
        document.getElementById("goalList");


    if(!db.goals.length){

        box.innerHTML=`
            <div class="empty">
                No savings goals yet.
            </div>
        `;

        return;

    }


    box.innerHTML =
        db.goals.map(g=>{

            const percent =
                Math.min(
                    100,
                    Math.round(
                        g.saved/g.target*100
                    )
                );


            return `

                <div class="goal-card">

                    <div class="goal-title">

                        <strong>
                            🎯 ${escapeHTML(g.name)}
                        </strong>

                        <span>
                            ${percent}%
                        </span>

                    </div>


                    <div class="progress">

                        <div
                            style="width:${percent}%">
                        </div>

                    </div>


                    <small style="color:var(--muted)">

                        ${money(g.saved)}
                        saved of
                        ${money(g.target)}

                    </small>


                    <button
                        onclick="addGoalMoney(${g.id})"
                        style="
                        float:right;
                        background:none;
                        color:var(--cyan);
                        font-size:9px;
                        font-weight:900">

                        + ADD

                    </button>

                </div>

            `;

        }).join("");

}


function addGoalMoney(id){

    const amount =
        Number(
            prompt("How much did you save?")
        );


    if(!amount || amount<=0)
        return;


    const goal =
        db.goals.find(
            g=>g.id===id
        );


    if(goal){

        goal.saved += amount;

        save();

        toast("Savings goal updated");

    }

}


/* ================= CHARTS ================= */

function updateCharts(){

    const t=totals();


    const canvas =
        document.getElementById("moneyChart");


    if(moneyChart)
        moneyChart.destroy();


    moneyChart =
        new Chart(canvas,{

            type:"line",

            data:{

                labels:[
                    "Income",
                    "Expenses",
                    "Savings"
                ],

                datasets:[{

                    label:"Money",

                    data:[
                        t.income,
                        t.expense,
                        Math.max(0,t.savings)
                    ],

                    tension:.4,

                    fill:true

                }]

            },

            options:{

                responsive:true,

                maintainAspectRatio:false,

                plugins:{

                    legend:{
                        display:false
                    }

                },

                scales:{

                    x:{
                        ticks:{
                            color:
                            getComputedStyle(document.body)
                            .getPropertyValue("--muted")
                        }
                    },

                    y:{
                        ticks:{
                            color:
                            getComputedStyle(document.body)
                            .getPropertyValue("--muted")
                        }
                    }

                }

            }

        });


    const categories={};


    db.transactions

    .filter(t=>t.type==="expense")

    .forEach(t=>{

        categories[t.category] =
            (categories[t.category]||0)
            +Number(t.amount);

    });


    const catCanvas =
        document.getElementById("categoryChart");


    if(categoryChart)
        categoryChart.destroy();


    categoryChart =
        new Chart(catCanvas,{

            type:"doughnut",

            data:{

                labels:Object.keys(categories),

                datasets:[{

                    data:Object.values(categories)

                }]

            },

            options:{

                responsive:true,

                maintainAspectRatio:false,

                plugins:{

                    legend:{

                        position:"bottom",

                        labels:{

                            color:
                            getComputedStyle(document.body)
                            .getPropertyValue("--muted"),

                            font:{
                                size:9
                            }

                        }

                    }

                }

            }

        });

}


/* ================= INSIGHTS ================= */

function renderInsights(){

    const t=totals();


    let score=50;


    if(t.income>0){

        const savingRate =
            t.savings/t.income;


        if(savingRate>=.30)
            score+=25;

        else if(savingRate>=.15)
            score+=15;

        else if(savingRate<0)
            score-=25;

    }


    if(db.budgets.length)
        score+=10;

    if(db.goals.length)
        score+=10;


    score =
        Math.max(
            0,
            Math.min(100,score)
        );


    document.getElementById("healthScore")
        .textContent=score;


    document.getElementById("healthText")
        .textContent =
        score>=75
        ? "Your tracked data shows strong saving and planning activity."
        : score>=50
        ? "Your finances are being tracked. Continue building consistent budgets and goals."
        : "Start tracking income, expenses and budgets to understand your financial position.";


    const categories={};


    db.transactions

    .filter(t=>t.type==="expense")

    .forEach(t=>{

        categories[t.category] =
            (categories[t.category]||0)
            +Number(t.amount);

    });


    const insights=[];


    if(!db.transactions.length){

        insights.push(
            "Add transactions to generate personalized insights."
        );

    }else{

        const largest =
            Object.entries(categories)
            .sort((a,b)=>b[1]-a[1])[0];


        if(largest){

            insights.push(
                `Your largest tracked expense category is ${largest[0]} at ${money(largest[1])}.`
            );

        }


        if(t.income>0){

            const rate =
                t.savings/t.income*100;


            insights.push(
                `Your current tracked savings rate is ${rate.toFixed(1)}%.`
            );

        }


        if(db.budgets.length){

            db.budgets.forEach(b=>{

                const spent =
                    db.transactions

                    .filter(t=>
                        t.type==="expense" &&
                        t.category===b.category
                    )

                    .reduce(
                        (s,t)=>s+Number(t.amount),
                        0
                    );


                if(spent>=b.amount){

                    insights.push(
                        `${b.category} budget has reached its current limit.`
                    );

                }

            });

        }


        if(db.goals.length){

            insights.push(
                `You currently have ${db.goals.length} savings goal(s).`
            );

        }

    }


    document.getElementById("smartInsights")
        .innerHTML =
        insights.map(i=>
            `<div class="insight">💡 ${escapeHTML(i)}</div>`
        ).join("");

}


/* ================= ACCOUNTS ================= */

function openAccounts(){

    document.getElementById("modalContent").innerHTML = `

        <h2>Accounts</h2>

        ${db.accounts.map(a=>`

            <div class="card" style="margin-bottom:9px">

                <strong>
                    🏦 ${escapeHTML(a.name)}
                </strong>

                <p style="
                    color:var(--muted);
                    margin-top:5px;
                    font-size:10px">

                    ${escapeHTML(a.type)}

                </p>

            </div>

        `).join("")}


        <button
            class="primary-btn"
            style="width:100%;margin-top:8px"
            onclick="addAccount()">

            ＋ Add account

        </button>

    `;

    openModal();

}


function addAccount(){

    const name =
        prompt("Account name:");


    if(!name)
        return;


    db.accounts.push({

        id:Date.now(),

        name,

        type:"Custom"

    });


    save();

    openAccounts();

}


/* ================= RECURRING ================= */

function openRecurring(){

    document.getElementById("modalContent").innerHTML = `

        <h2>Recurring Payments</h2>

        <div class="form">

            <label>NAME</label>

            <input
                id="recName"
                placeholder="Rent / subscription / EMI">


            <label>AMOUNT</label>

            <input
                id="recAmount"
                type="number"
                placeholder="₹0">


            <label>NEXT PAYMENT</label>

            <input
                id="recDate"
                type="date"
                value="${today()}">


            <label>CATEGORY</label>

            <input
                id="recCategory"
                placeholder="Bills">


            <button onclick="addRecurring()">
                SAVE PAYMENT
            </button>

        </div>


        <div style="margin-top:20px">

            ${
                db.recurring.map(r=>`

                    <div class="card"
                         style="margin-bottom:8px">

                        <strong>
                            ${escapeHTML(r.name)}
                        </strong>

                        <p style="
                            color:var(--muted);
                            font-size:10px;
                            margin-top:5px">

                            ${money(r.amount)}
                            •
                            ${r.nextDate}

                        </p>

                    </div>

                `).join("")
            }

        </div>

    `;

    openModal();

}


function addRecurring(){

    const name =
        document.getElementById("recName")
        .value.trim();

    const amount =
        Number(
            document.getElementById("recAmount").value
        );

    const date =
        document.getElementById("recDate").value;

    const category =
        document.getElementById("recCategory").value
        || "Bills";


    if(!name || amount<=0 || !date){

        toast("Complete the payment details");

        return;

    }


    db.recurring.push({

        id:Date.now(),

        name,

        amount,

        nextDate:date,

        category

    });


    closeModal();

    save();

    toast("Recurring payment added");

}


/* ================= LOANS ================= */

function openLoans(){

    document.getElementById("modalContent").innerHTML = `

        <h2>Loans & EMI</h2>

        <div class="form">

            <label>LOAN NAME</label>

            <input
                id="loanName"
                placeholder="Education loan">


            <label>REMAINING AMOUNT</label>

            <input
                id="loanAmount"
                type="number"
                placeholder="₹0">


            <label>MONTHLY EMI</label>

            <input
                id="loanEmi"
                type="number"
                placeholder="₹0">


            <button onclick="addLoan()">
                ADD LOAN
            </button>

        </div>


        <div style="margin-top:18px">

            ${
                (db.loans||[]).map(l=>`

                    <div class="card"
                         style="margin-bottom:8px">

                        <strong>
                            ${escapeHTML(l.name)}
                        </strong>

                        <p style="
                            color:var(--muted);
                            margin-top:5px;
                            font-size:10px">

                            Remaining:
                            ${money(l.amount)}

                            • EMI:
                            ${money(l.emi)}

                        </p>

                    </div>

                `).join("")
            }

        </div>

    `;

    openModal();

}


function addLoan(){

    const name =
        document.getElementById("loanName")
        .value.trim();

    const amount =
        Number(
            document.getElementById("loanAmount").value
        );

    const emi =
        Number(
            document.getElementById("loanEmi").value
        );


    if(!name || amount<=0 || emi<=0){

        toast("Enter valid loan details");

        return;

    }


    if(!db.loans)
        db.loans=[];


    db.loans.push({

        id:Date.now(),

        name,

        amount,

        emi

    });


    closeModal();

    save();

    toast("Loan added");

}


/* ================= SCANNER ================= */

function openScanner(){

    document.getElementById("modalContent").innerHTML = `

        <h2>Smart Receipt Scanner</h2>

        <div class="scanner">

            <div class="scanner-icon">
                📷
            </div>

            <p>
                Upload a clear receipt image.
                The browser will attempt to read
                the text and identify a possible total.
            </p>

            <input
                type="file"
                accept="image/*"
                onchange="scanReceipt(event)">

            <div
                id="scanStatus"
                style="
                    color:var(--cyan);
                    font-size:10px">
            </div>

            <div id="ocrResult"></div>

        </div>

    `;

    openModal();

}


async function scanReceipt(event){

    const file =
        event.target.files[0];


    if(!file)
        return;


    const status =
        document.getElementById("scanStatus");


    status.textContent =
        "Preparing OCR...";


    try{

        const result =
            await Tesseract.recognize(
                file,
                "eng",
                {
                    logger:m=>{

                        if(
                            m.status ===
                            "recognizing text"
                        ){

                            status.textContent =
                                "Reading "
                                +
                                Math.round(
                                    m.progress*100
                                )
                                +
                                "%";

                        }

                    }
                }
            );


        const text =
            result.data.text;


        const matches =
            text.match(
                /(?:₹|Rs\.?|INR)?\s*[0-9,]+(?:\.[0-9]{1,2})?/gi
            ) || [];


        const values =
            matches
            .map(x=>
                Number(
                    x.replace(/[^\d.]/g,"")
                )
            )
            .filter(x=>x>0);


        const possibleTotal =
            values.length
            ? Math.max(...values)
            : 0;


        document.getElementById("ocrResult").innerHTML = `

            <div class="card"
                 style="margin-top:15px">

                <span class="eyebrow">
                    OCR RESULT
                </span>

                <p style="
                    margin-top:10px;
                    color:var(--muted);
                    font-size:9px;
                    white-space:pre-wrap;
                    max-height:130px;
                    overflow:auto">

                    ${escapeHTML(text)}

                </p>

                <p style="
                    margin-top:12px;
                    font-size:12px">

                    POSSIBLE TOTAL:
                    <strong>
                        ${money(possibleTotal)}
                    </strong>

                </p>


                <button
                    class="primary-btn"
                    style="width:100%;margin-top:12px"
                    onclick="saveScannedReceipt(${possibleTotal})">

                    SAVE AS EXPENSE

                </button>

            </div>

        `;


        status.textContent =
            "Scan complete";


    }catch(error){

        status.textContent =
            "Could not read receipt. Try a clearer image.";

    }

}


function saveScannedReceipt(amount){

    if(!amount){

        closeModal();

        openTransaction("expense");

        return;

    }


    db.transactions.push({

        id:Date.now(),

        created:Date.now(),

        title:"Scanned receipt",

        amount,

        category:"Other",

        date:today(),

        account:
            db.accounts[0]?.name || "Cash",

        type:"expense",

        notes:"Receipt OCR"

    });


    closeModal();

    save();

    toast("Receipt saved");

}


/* ================= CALENDAR ================= */

function openCalendar(){

    const list =
        [...db.transactions]
        .sort((a,b)=>
            a.date.localeCompare(b.date)
        );


    document.getElementById("modalContent").innerHTML = `

        <h2>Financial Calendar</h2>

        ${
            list.length

            ?

            list.map(t=>transactionHTML(t)).join("")

            :

            `
                <div class="empty">
                    No financial events yet.
                </div>
            `
        }

    `;

    openModal();

}


/* ================= PREMIUM ================= */

function openPremium(){

    document.getElementById("modalContent").innerHTML = `

        <div style="text-align:center">

            <div class="pro-logo"
                 style="margin:auto">

                PRO

            </div>

            <h2 style="margin-top:14px">
                Finance Manager Pro
            </h2>

            <p style="
                color:var(--muted);
                font-size:11px;
                line-height:1.7;
                margin-bottom:20px">

                Unlock the complete finance toolkit.

            </p>

        </div>


        <div class="plan">

            <div class="plan-top">

                <div>

                    <div class="plan-name">
                        1 MONTH
                    </div>

                    <div class="plan-desc">
                        Premium access
                    </div>

                </div>

                <div class="plan-price">
                    ₹49
                </div>

            </div>


            <button onclick="startPurchase('monthly')">
                CONTINUE
            </button>

        </div>


        <div class="plan recommended">

            <div class="plan-top">

                <div>

                    <div class="plan-name">
                        2 MONTHS
                    </div>

                    <div class="plan-desc">
                        Premium access
                    </div>

                </div>

                <div class="plan-price">
                    ₹95
                </div>

            </div>


            <button onclick="startPurchase('two_month')">
                CONTINUE
            </button>

        </div>


        <button
            class="restore"
            onclick="restorePurchases()">

            RESTORE PURCHASES

        </button>


        <p style="
            color:var(--muted);
            font-size:8px;
            text-align:center;
            line-height:1.6;
            margin-top:14px">

            Android production version:
            purchases are completed through
            Google Play Billing and verified before
            premium access is granted.

        </p>

    `;

    openModal();

}


/*
    WEB SAFETY:

    Do NOT pretend a payment happened here.

    These product IDs are placeholders for the
    Android Google Play Billing implementation.
*/

const PLAY_PRODUCTS = {

    monthly:"finance_manager_pro_1_month",

    two_month:"finance_manager_pro_2_months"

};


function startPurchase(plan){

    const productId =
        PLAY_PRODUCTS[plan];


    /*
        Android bridge placeholder.

        The Android project will expose something like:

        window.AndroidBilling.purchase(productId)

        The native Android side then launches
        Google Play Billing.
    */


    if(
        window.AndroidBilling &&
        typeof window.AndroidBilling.purchase === "function"
    ){

        window.AndroidBilling.purchase(productId);

        return;

    }


    toast(
        "Connect this plan to Google Play Billing in the Android app."
    );

}


function restorePurchases(){

    if(
        window.AndroidBilling &&
        typeof window.AndroidBilling.restore === "function"
    ){

        window.AndroidBilling.restore();

        return;

    }


    toast(
        "Restore purchases is available in the Android build."
    );

}


/*
    Called by the Android app AFTER it has verified
    the Google Play purchase.

    Example native bridge:

    window.unlockPremium()
*/

window.unlockPremium=function(){

    db.premium=true;

    save();

    closeModal();

    toast("Premium activated");

};


/* ================= EXPORT ================= */

function exportData(){

    const file =
        new Blob(
            [
                JSON.stringify(
                    db,
                    null,
                    2
                )
            ],
            {
                type:"application/json"
            }
        );


    const url =
        URL.createObjectURL(file);


    const a =
        document.createElement("a");


    a.href=url;

    a.download=
        "finance-manager-backup.json";


    a.click();


    URL.revokeObjectURL(url);


    toast("Backup exported");

}


function restoreData(){

    const input =
        document.createElement("input");


    input.type="file";

    input.accept=".json";


    input.onchange=function(event){

        const file =
            event.target.files[0];


        if(!file)
            return;


        const reader =
            new FileReader();


        reader.onload=function(){

            try{

                const imported =
                    JSON.parse(
                        reader.result
                    );


                if(
                    !imported.transactions ||
                    !imported.accounts
                ){

                    throw new Error();

                }


                db=imported;

                save();

                toast(
                    "Backup restored successfully"
                );


            }catch{

                toast(
                    "Invalid Finance Manager backup"
                );

            }

        };


        reader.readAsText(file);

    };


    input.click();

}


/* ================= REPORT ================= */

function generateReport(){

    const t=totals();


    const rate =
        t.income
        ? (t.savings/t.income*100)
        : 0;


    const report = `

FINANCE MANAGER
MONTHLY FINANCIAL REPORT

------------------------------

TOTAL INCOME
${money(t.income)}

TOTAL EXPENSES
${money(t.expense)}

NET SAVINGS
${money(t.savings)}

SAVINGS RATE
${rate.toFixed(1)}%

TRANSACTIONS
${db.transactions.length}

BUDGETS
${db.budgets.length}

SAVINGS GOALS
${db.goals.length}

RECURRING PAYMENTS
${db.recurring.length}

------------------------------

Generated by Finance Manager

`;


    const blob =
        new Blob(
            [report],
            {type:"text/plain"}
        );


    const a =
        document.createElement("a");


    a.href =
        URL.createObjectURL(blob);


    a.download =
        "finance-manager-report.txt";


    a.click();


    toast("Report generated");

}


/* ================= ABOUT ================= */

function showAbout(){

    document.getElementById("modalContent").innerHTML = `

        <div style="text-align:center">

            <div class="logo"
                 style="margin:auto">

                FM

            </div>

            <h2 style="margin-top:15px">
                FINANCE MANAGER
            </h2>

            <p style="
                color:var(--muted);
                font-size:11px;
                line-height:1.8">

                Version 2.0 MAX<br>

                Smart personal finance management.

            </p>

        </div>

    `;

    openModal();

}


/* ================= MODAL ================= */

function openModal(){

    document
        .getElementById("modal")
        .classList.add("show");

}


function closeModal(){

    document
        .getElementById("modal")
        .classList.remove("show");

}


/* ================= RENDER ================= */

function renderEverything(){

    applyTheme();

    renderHome();

    renderTransactions();

    renderBudgets();

    renderInsights();


    document.getElementById("currentDate")
        .textContent =
        new Date().toLocaleDateString(
            "en-IN",
            {
                weekday:"long",
                day:"numeric",
                month:"long",
                year:"numeric"
            }
        );


    setTimeout(
        updateCharts,
        80
    );

}


renderEverything();
