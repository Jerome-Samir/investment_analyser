import streamlit as st
import numpy as np
import altair as alt
import pandas as pd

st.set_page_config(page_title="Investment Property Calculator", layout="wide", page_icon="🏠")

st.markdown("""
<style>
header[data-testid="stHeader"]::after {
    content: "Investment Property Calculator";
    position: absolute;
    left: 4rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 1.8rem;
    font-weight: 600;
    color: #333;
}
@media (prefers-color-scheme: dark) {
    header[data-testid="stHeader"]::after { color: #fafafa; }
}
section[data-testid="stSidebar"] > div:first-child {
    padding-top: 0rem;
}
section[data-testid="stSidebar"] .stCheckbox label p {
    font-size: 0.875rem;
}
</style>
""", unsafe_allow_html=True)


# --- Tax helpers (Australian 2024-25 Stage 3 rates) ---

def calc_income_tax(taxable: float) -> float:
    if taxable <= 18_200:
        return 0
    if taxable <= 45_000:
        return (taxable - 18_200) * 0.16
    if taxable <= 135_000:
        return 4_288 + (taxable - 45_000) * 0.30
    if taxable <= 190_000:
        return 31_288 + (taxable - 135_000) * 0.37
    return 51_638 + (taxable - 190_000) * 0.45


def calc_tax_with_medicare(taxable: float) -> float:
    return calc_income_tax(taxable) + max(0, taxable) * 0.02


def marginal_rate(taxable: float) -> float:
    medicare = 0.02
    if taxable <= 18_200:
        return 0 + medicare
    if taxable <= 45_000:
        return 0.16 + medicare
    if taxable <= 135_000:
        return 0.30 + medicare
    if taxable <= 190_000:
        return 0.37 + medicare
    return 0.45 + medicare


# NSW Transfer (Stamp) Duty – standard residential rates
def calc_stamp_duty_nsw(price: float) -> float:
    if price <= 17_000:
        return price * 0.0125
    if price <= 36_000:
        return 212.50 + (price - 17_000) * 0.015
    if price <= 97_000:
        return 497.50 + (price - 36_000) * 0.0175
    if price <= 364_000:
        return 1_565 + (price - 97_000) * 0.035
    if price <= 1_212_000:
        return 10_910 + (price - 364_000) * 0.045
    return 49_070 + (price - 1_212_000) * 0.055


# Approximate LMI premium (% of loan) by LVR band
def calc_lmi(price: float, deposit_pct: float) -> float:
    if deposit_pct >= 20:
        return 0
    lvr = 100 - deposit_pct
    loan = price * lvr / 100
    if lvr <= 85:
        return loan * 0.01
    if lvr <= 90:
        return loan * 0.022
    return loan * 0.035


# NSW government fees
MORTGAGE_REGISTRATION_FEE = 187.20
TRANSFER_FEE = 165.40
LEGAL_FEES = 2_000
MONTHLY_COUNCIL_WATER = 150


def compute_breakeven(price, weekly_rental, weekly_rent, income, rate, deposit_pct, capitalise_lmi=False, yearly_strata=0, is_apartment=False):
    lmi = calc_lmi(price, deposit_pct)
    mortgage = price * (1 - deposit_pct / 100) + (lmi if capitalise_lmi else 0)
    monthly_interest = mortgage * (rate / 100) / 12
    yearly_rental_income = weekly_rental * 52
    yearly_rental_agent_fee = yearly_rental_income * 0.07
    yearly_insurance = 0 if is_apartment else (2_000 if price > 0 else 0)
    yearly_council_water = MONTHLY_COUNCIL_WATER * 12
    yearly_interest = monthly_interest * 12
    yearly_rent = weekly_rent * 52
    yearly_pre_tax = yearly_rental_income - yearly_rental_agent_fee - yearly_insurance - yearly_council_water - yearly_strata - yearly_rent - yearly_interest

    property_net = yearly_rental_income - yearly_rental_agent_fee - yearly_insurance - yearly_council_water - yearly_strata - yearly_interest
    deductible_loss = max(0, -property_net)

    tax_without = calc_tax_with_medicare(income)
    tax_with = calc_tax_with_medicare(income - deductible_loss)
    tax_saving = tax_without - tax_with
    yearly_after_tax = yearly_pre_tax + tax_saving

    base_taxable_income = income - deductible_loss

    steps = 301
    prev_net = None
    prev_rate = None

    for i in range(steps):
        app_rate = (i / (steps - 1)) * 20
        yearly_app = price * (app_rate / 100)
        taxable_cg = yearly_app * 0.50
        tax_with_cgt = calc_tax_with_medicare(base_taxable_income + taxable_cg)
        tax_without_cgt = calc_tax_with_medicare(base_taxable_income)
        cgt_owed = tax_with_cgt - tax_without_cgt
        net_position = yearly_after_tax + yearly_app - cgt_owed

        if i == 0 and net_position >= 0:
            return 0.0

        if prev_net is not None and prev_net < 0 and net_position >= 0:
            t = -prev_net / (net_position - prev_net)
            return prev_rate + t * (app_rate - prev_rate)

        prev_net = net_position
        prev_rate = app_rate

    return None


# --- Formatting helpers ---

def fmt(n: float) -> str:
    return f"${abs(n):,.2f}"


def signed_fmt(n: float) -> str:
    prefix = "+" if n >= 0 else "-"
    return f"{prefix}${abs(n):,.2f}"


# --- Inputs ---

with st.sidebar:
    st.header("Inputs")
    price = st.number_input("Property Price ($)", min_value=0, value=850_000, step=10_000)
    dep_col, lmi_col = st.columns([2, 1])
    with dep_col:
        deposit_pct = st.slider("Deposit (%)", min_value=5, max_value=30, value=5, step=1)
    with lmi_col:
        capitalise_lmi = st.checkbox("Capitalise LMI", value=True, label_visibility="visible") if deposit_pct < 20 else False
    weekly_rental = st.number_input("Rental Income (weekly $)", min_value=0, value=600, step=10)
    weekly_rent = st.number_input("Your Rent Spend (weekly $)", min_value=0, value=850, step=10)
    income = st.number_input("Gross Income (annual, pre-tax $)", min_value=0, value=110_000, step=1_000)
    rate = st.number_input("Bank Interest Rate (annual %)", min_value=0.0, value=6.1, step=0.01, format="%.2f")
    property_type = st.segmented_control("Property Type", ["House", "Apartment"], default="House", selection_mode="single")
    if property_type == "Apartment":
        quarterly_strata = st.number_input("Strata Fees (quarterly $)", min_value=0, value=1_500, step=100)
    else:
        quarterly_strata = 0
    include_buyer_agent = st.checkbox("Include Buyer's Agent Fee (2%)", value=True)

# --- Calculations ---

yearly_strata = quarterly_strata * 4
monthly_strata = yearly_strata / 12

lmi = calc_lmi(price, deposit_pct)
mortgage = price * (1 - deposit_pct / 100) + (lmi if capitalise_lmi else 0)
monthly_interest = mortgage * (rate / 100) / 12
monthly_rental = weekly_rental * 52 / 12
monthly_rental_agent_fee = monthly_rental * 0.07
is_apartment = property_type == "Apartment"
yearly_insurance = 0 if is_apartment else (2_000 if price > 0 else 0)
monthly_insurance = yearly_insurance / 12
monthly_council_water = MONTHLY_COUNCIL_WATER
monthly_rent = weekly_rent * 52 / 12
monthly_net = monthly_rental - monthly_rental_agent_fee - monthly_insurance - monthly_council_water - monthly_strata - monthly_rent - monthly_interest
yearly_pre_tax = monthly_net * 12

yearly_rental_income = weekly_rental * 52
yearly_rental_agent_fee = yearly_rental_income * 0.07
yearly_interest = monthly_interest * 12
yearly_council_water = MONTHLY_COUNCIL_WATER * 12
property_net = yearly_rental_income - yearly_rental_agent_fee - yearly_insurance - yearly_council_water - yearly_strata - yearly_interest
deductible_loss = max(0, -property_net)

tax_without = calc_tax_with_medicare(income)
tax_with = calc_tax_with_medicare(income - deductible_loss)
tax_saving = tax_without - tax_with
yearly_after_tax = yearly_pre_tax + tax_saving

# Upfront costs
deposit = price * deposit_pct / 100
stamp_duty = calc_stamp_duty_nsw(price)
lmi_upfront = 0 if capitalise_lmi else lmi
buyer_agent_fee = price * 0.02 if include_buyer_agent else 0
total_upfront = deposit + stamp_duty + lmi_upfront + buyer_agent_fee + MORTGAGE_REGISTRATION_FEE + TRANSFER_FEE + LEGAL_FEES

# Take home
take_home_yearly = income - tax_with + yearly_pre_tax

# --- Display ---

col1, col2, col3 = st.columns(3)

with col1:
    st.subheader("Upfront Costs")
    st.metric("Total Upfront", fmt(total_upfront))
    if lmi > 0 and capitalise_lmi:
        lmi_row = f"| LMI (capitalised) | {fmt(lmi)} |\n"
    elif lmi > 0:
        lmi_row = f"| LMI | {fmt(lmi)} |\n"
    else:
        lmi_row = ""
    buyer_agent_row = f"| Buyer's Agent Fee (2%) | {fmt(buyer_agent_fee)} |\n" if include_buyer_agent else ""
    st.markdown(f"""
| Item | Amount |
|---|---|
| Deposit ({deposit_pct}%) | {fmt(deposit)} |
| Stamp (transfer) Duty (NSW) | {fmt(stamp_duty)} |
{lmi_row}{buyer_agent_row}| Legal Fees | {fmt(LEGAL_FEES)} |
| Govt. Fees :grey_question: | {fmt(MORTGAGE_REGISTRATION_FEE + TRANSFER_FEE)} |
| **Total** | **{fmt(total_upfront)}** |
""")
    st.caption(":grey_question: Govt. Fees = Mortgage Registration + Transfer Fee")

with col2:
    st.subheader("After-Tax Yearly Cost")
    label = "saving" if yearly_after_tax >= 0 else "cost"
    delta_color = "normal" if yearly_after_tax >= 0 else "inverse"
    st.metric("Yearly Net (after tax)", f"{signed_fmt(yearly_after_tax)} / yr", delta=label, delta_color=delta_color)
    strata_insurance_row = f"| Strata fees | -{fmt(monthly_strata)} |\n" if is_apartment else f"| House insurance | -{fmt(monthly_insurance)} |\n"
    st.markdown(f"""
| Property Breakdown | Monthly |
|---|---|
| Mortgage ({100 - deposit_pct}% LVR) | {fmt(mortgage)} |
| Interest | -{fmt(monthly_interest)} |
| Rental income | {fmt(monthly_rental)} |
| Rental agent fee (7%) | -{fmt(monthly_rental_agent_fee)} |
{strata_insurance_row}| Council + Water | -{fmt(monthly_council_water)} |
| Rent spend | -{fmt(monthly_rent)} |
| **Net (pre-tax)** | **{signed_fmt(monthly_net)}** |
| **Yearly net (pre-tax)** | **{signed_fmt(yearly_pre_tax)}** |
""")

with col3:
    st.subheader("Tax Impact")
    st.caption(f"Negative Gearing (2024-25 rates + 2% Medicare)")
    st.markdown(f"""
| Tax Detail | Value |
|---|---|
| Marginal tax rate | {marginal_rate(income) * 100:.0f}% |
| Property loss (deductible) | {fmt(deductible_loss) if deductible_loss > 0 else "N/A (no loss)"} |
| Tax saving | {("+" + fmt(tax_saving)) if tax_saving > 0 else fmt(0)} |
| **Yearly net (after tax)** | **{signed_fmt(yearly_after_tax)}** |
""")
    st.divider()
    st.markdown(f"""
| Take Home | Amount |
|---|---|
| Yearly | {fmt(take_home_yearly)} |
| Monthly | {fmt(take_home_yearly / 12)} |
""")

# --- Charts ---

st.divider()

base_taxable_income = income - deductible_loss
steps = 61
app_rates = np.linspace(0, 20, steps)
net_positions = []
cgt_values = []
appreciation_values = []
breakeven_rate = None

for i, app_rate in enumerate(app_rates):
    yearly_app = price * (app_rate / 100)
    taxable_cg = yearly_app * 0.50
    tax_with_cgt = calc_tax_with_medicare(base_taxable_income + taxable_cg)
    tax_without_cgt = calc_tax_with_medicare(base_taxable_income)
    cgt_owed = tax_with_cgt - tax_without_cgt
    net_position = yearly_after_tax + yearly_app - cgt_owed
    net_positions.append(net_position)
    cgt_values.append(cgt_owed)
    appreciation_values.append(yearly_app)

    if i > 0 and breakeven_rate is None:
        prev = net_positions[i - 1]
        if prev < 0 and net_position >= 0:
            t = -prev / (net_position - prev)
            breakeven_rate = app_rates[i - 1] + t * (app_rate - app_rates[i - 1])

chart1, chart2, chart3 = st.columns(3)

with chart1:
    st.markdown("<div style='text-align:center'><b>Net Yearly Position vs Appreciation</b></div>", unsafe_allow_html=True)

    # Build line segments split at zero crossing so color changes at breakeven
    rates_arr = list(app_rates)
    nets_arr = list(net_positions)
    expanded_rates = []
    expanded_nets = []
    expanded_colors = []
    for i in range(len(rates_arr)):
        # Insert interpolated zero-crossing point before this point if sign changed
        if i > 0 and ((nets_arr[i - 1] < 0) != (nets_arr[i] < 0)):
            t = -nets_arr[i - 1] / (nets_arr[i] - nets_arr[i - 1])
            cross_r = rates_arr[i - 1] + t * (rates_arr[i] - rates_arr[i - 1])
            # Close previous segment at crossing
            expanded_rates.append(cross_r)
            expanded_nets.append(0.0)
            expanded_colors.append("Positive" if nets_arr[i - 1] >= 0 else "Negative")
            # Start new segment at crossing
            expanded_rates.append(cross_r)
            expanded_nets.append(0.0)
            expanded_colors.append("Positive" if nets_arr[i] >= 0 else "Negative")
        expanded_rates.append(rates_arr[i])
        expanded_nets.append(nets_arr[i])
        expanded_colors.append("Positive" if nets_arr[i] >= 0 else "Negative")

    df = pd.DataFrame({
        "Appreciation Rate (%)": expanded_rates,
        "Net Position ($)": expanded_nets,
        "Color": expanded_colors,
    })

    line = alt.Chart(df).mark_line(strokeWidth=2.5).encode(
        x=alt.X("Appreciation Rate (%):Q"),
        y=alt.Y("Net Position ($):Q"),
        color=alt.Color("Color:N", scale=alt.Scale(domain=["Positive", "Negative"], range=["#16a34a", "#dc2626"]), legend=None),
        detail="Color:N",
    )
    zero = alt.Chart(pd.DataFrame({"Net Position ($)": [0]})).mark_rule(strokeDash=[4, 4], color="#ccc").encode(y="Net Position ($):Q")
    chart = (line + zero).properties(height=260)

    if breakeven_rate is not None:
        be_df = pd.DataFrame({"Appreciation Rate (%)": [breakeven_rate], "Net Position ($)": [0]})
        dot = alt.Chart(be_df).mark_circle(size=60, color="#333").encode(x="Appreciation Rate (%):Q", y="Net Position ($):Q")
        chart = chart + dot

    st.altair_chart(chart, use_container_width=True)
    if breakeven_rate is not None:
        st.caption(f"Break-even at **{breakeven_rate:.1f}% appreciation** ({fmt(price * breakeven_rate / 100)}/yr)")
    elif net_positions[0] >= 0:
        st.caption("Net positive at all appreciation rates.")
    else:
        st.caption("Net negative across the entire 0-20% range.")

with chart2:
    st.markdown("<div style='text-align:center'><b>Break-Even vs Rent Difference (weekly)</b></div>", unsafe_allow_html=True)
    current_rent_diff = weekly_rent - weekly_rental
    rd_min = current_rent_diff - 750
    rd_max = current_rent_diff + 750
    rd_points = []
    for ri in range(81):
        rd = rd_min + (rd_max - rd_min) * ri / 80
        wr = weekly_rental + rd
        if wr < 0:
            continue
        be = compute_breakeven(price, weekly_rental, wr, income, rate, deposit_pct, capitalise_lmi, yearly_strata, is_apartment)
        if be is not None:
            rd_points.append({"Break-Even (%)": be, "Rent Diff ($/wk)": rd})

    if len(rd_points) >= 2:
        rd_df = pd.DataFrame(rd_points)
        rd_line = alt.Chart(rd_df).mark_line(strokeWidth=2.5, color="#3b82f6").encode(
            x=alt.X("Break-Even (%):Q"),
            y="Rent Diff ($/wk):Q",
        )
        rd_chart = rd_line.properties(height=260)
        if breakeven_rate is not None:
            mk_df = pd.DataFrame({"Break-Even (%)": [breakeven_rate], "Rent Diff ($/wk)": [current_rent_diff]})
            mk = alt.Chart(mk_df).mark_circle(size=80, color="#333").encode(x="Break-Even (%):Q", y="Rent Diff ($/wk):Q")
            rd_chart = rd_chart + mk
        st.altair_chart(rd_chart, use_container_width=True)
    else:
        st.info("Insufficient data")

    if breakeven_rate is not None:
        sign = "" if current_rent_diff >= 0 else "-"
        st.caption(f"Current: **{sign}${abs(current_rent_diff):.0f}/wk** → {breakeven_rate:.1f}% to break even")
    else:
        st.caption("Current rent difference has no break-even in 0-20%.")

with chart3:
    st.markdown("<div style='text-align:center'><b>Break-Even vs Property Price (±30%)</b></div>", unsafe_allow_html=True)
    p_min = price * 0.7
    p_max = price * 1.3
    pp_points = []
    for pi in range(81):
        pp = p_min + (p_max - p_min) * pi / 80
        be2 = compute_breakeven(pp, weekly_rental, weekly_rent, income, rate, deposit_pct, capitalise_lmi, yearly_strata, is_apartment)
        if be2 is not None:
            pp_points.append({"Break-Even (%)": be2, "Property Price ($)": pp})

    if len(pp_points) >= 2:
        pp_df = pd.DataFrame(pp_points)
        pp_line = alt.Chart(pp_df).mark_line(strokeWidth=2.5, color="#3b82f6").encode(
            x=alt.X("Break-Even (%):Q"),
            y="Property Price ($):Q",
        )
        pp_chart = pp_line.properties(height=260)
        if breakeven_rate is not None:
            mk2_df = pd.DataFrame({"Break-Even (%)": [breakeven_rate], "Property Price ($)": [float(price)]})
            mk2 = alt.Chart(mk2_df).mark_circle(size=80, color="#333").encode(x="Break-Even (%):Q", y="Property Price ($):Q")
            pp_chart = pp_chart + mk2
        st.altair_chart(pp_chart, use_container_width=True)
    else:
        st.info("Insufficient data")

    if breakeven_rate is not None:
        st.caption(f"Current: **{fmt(price)}** → {breakeven_rate:.1f}% to break even")
    else:
        st.caption("Current price has no break-even in 0-20%.")

# --- Deposit sensitivity charts ---

st.divider()

dep_range = list(range(5, 31))
dep_yearly_nets = []
dep_upfronts = []
dep_breakevens = []

for dp in dep_range:
    dp_lmi = calc_lmi(price, dp)
    dp_mortgage = price * (1 - dp / 100) + (dp_lmi if capitalise_lmi else 0)
    dp_monthly_interest = dp_mortgage * (rate / 100) / 12
    dp_yearly_interest = dp_monthly_interest * 12
    dp_yearly_council_water = MONTHLY_COUNCIL_WATER * 12
    dp_yearly_pre_tax = yearly_rental_income - yearly_rental_agent_fee - yearly_insurance - dp_yearly_council_water - yearly_strata - (weekly_rent * 52) - dp_yearly_interest
    dp_property_net = yearly_rental_income - yearly_rental_agent_fee - yearly_insurance - dp_yearly_council_water - yearly_strata - dp_yearly_interest
    dp_deductible_loss = max(0, -dp_property_net)
    dp_tax_saving = calc_tax_with_medicare(income) - calc_tax_with_medicare(income - dp_deductible_loss)
    dp_yearly_after_tax = dp_yearly_pre_tax + dp_tax_saving
    dep_yearly_nets.append(dp_yearly_after_tax)

    dp_deposit = price * dp / 100
    dp_lmi_upfront = 0 if capitalise_lmi else dp_lmi
    dp_upfront = dp_deposit + stamp_duty + dp_lmi_upfront + buyer_agent_fee + MORTGAGE_REGISTRATION_FEE + TRANSFER_FEE + LEGAL_FEES
    dep_upfronts.append(dp_upfront)

    # Break-even
    be = compute_breakeven(price, weekly_rental, weekly_rent, income, rate, dp, capitalise_lmi, yearly_strata, is_apartment)
    dep_breakevens.append(be)

chart4, chart5, chart6 = st.columns(3)

with chart4:
    st.markdown("<div style='text-align:center'><b>Yearly Net vs Deposit %</b></div>", unsafe_allow_html=True)
    df4 = pd.DataFrame({"Deposit (%)": dep_range, "Yearly Net ($)": dep_yearly_nets})
    c4_line = alt.Chart(df4).mark_line(strokeWidth=2.5, color="#3b82f6").encode(
        x=alt.X("Deposit (%):Q", scale=alt.Scale(domain=[5, 30])),
        y="Yearly Net ($):Q",
    )
    c4_zero = alt.Chart(pd.DataFrame({"Yearly Net ($)": [0]})).mark_rule(strokeDash=[4, 4], color="#ccc").encode(y="Yearly Net ($):Q")
    c4_mk = alt.Chart(pd.DataFrame({"Deposit (%)": [deposit_pct], "Yearly Net ($)": [yearly_after_tax]})).mark_circle(size=80, color="#333").encode(x="Deposit (%):Q", y="Yearly Net ($):Q")
    st.altair_chart((c4_line + c4_zero + c4_mk).properties(height=260), use_container_width=True)

with chart5:
    st.markdown("<div style='text-align:center'><b>Upfront Costs vs Deposit %</b></div>", unsafe_allow_html=True)
    df5 = pd.DataFrame({"Deposit (%)": dep_range, "Upfront ($)": dep_upfronts})
    c5_line = alt.Chart(df5).mark_line(strokeWidth=2.5, color="#3b82f6").encode(
        x=alt.X("Deposit (%):Q", scale=alt.Scale(domain=[5, 30])),
        y="Upfront ($):Q",
    )
    c5_mk = alt.Chart(pd.DataFrame({"Deposit (%)": [deposit_pct], "Upfront ($)": [total_upfront]})).mark_circle(size=80, color="#333").encode(x="Deposit (%):Q", y="Upfront ($):Q")
    st.altair_chart((c5_line + c5_mk).properties(height=260), use_container_width=True)

with chart6:
    st.markdown("<div style='text-align:center'><b>Break-Even % vs Deposit %</b></div>", unsafe_allow_html=True)
    be_points = [{"Deposit (%)": dp, "Break-Even (%)": be} for dp, be in zip(dep_range, dep_breakevens) if be is not None]
    if len(be_points) >= 2:
        df6 = pd.DataFrame(be_points)
        c6_line = alt.Chart(df6).mark_line(strokeWidth=2.5, color="#3b82f6").encode(
            x=alt.X("Deposit (%):Q", scale=alt.Scale(domain=[5, 30])),
            y="Break-Even (%):Q",
        )
        c6_chart = c6_line.properties(height=260)
        if breakeven_rate is not None:
            c6_mk = alt.Chart(pd.DataFrame({"Deposit (%)": [deposit_pct], "Break-Even (%)": [breakeven_rate]})).mark_circle(size=80, color="#333").encode(x="Deposit (%):Q", y="Break-Even (%):Q")
            c6_chart = c6_chart + c6_mk
        st.altair_chart(c6_chart, use_container_width=True)
    else:
        st.info("Insufficient data")
