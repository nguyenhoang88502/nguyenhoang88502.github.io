import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

st.set_page_config(
    page_title="Manufacturing Failure Analysis Dashboard",
    page_icon="🏭",
    layout="wide"
)

# ─────────────────────────────────────────────
# DATA LOADING
# ─────────────────────────────────────────────
@st.cache_data
def load_data():
    failure_dist  = pd.read_csv("dw/OLAP Failure Distribution by Failure Type.csv")
    quality_rate  = pd.read_csv("dw/OLAP Failure Rate by Product Quality Type.csv")
    machine_cond  = pd.read_csv("dw/OLAP Machine Condition vs Failure Rate.csv")
    monthly_trend = pd.read_csv("dw/OLAP Monthly Failure Trend.csv")
    monthly_trend["Month Name"] = monthly_trend["Month Name"].str.strip()
    return failure_dist, quality_rate, machine_cond, monthly_trend

failure_dist, quality_rate, machine_cond, monthly_trend = load_data()

# ─────────────────────────────────────────────
# SIDEBAR FILTERS
# ─────────────────────────────────────────────
with st.sidebar:
    st.image("https://img.icons8.com/fluency/96/factory.png", width=64)
    st.title("Dashboard Filters")
    st.markdown("---")

    all_types = failure_dist["Failure Type"].tolist()
    selected_types = st.multiselect(
        "Failure Types",
        options=all_types,
        default=all_types,
        help="Filter the failure distribution chart"
    )

    all_months = monthly_trend["Month Name"].tolist()
    selected_months = st.multiselect(
        "Months",
        options=all_months,
        default=all_months,
        help="Filter the monthly trend chart"
    )

    all_conditions = machine_cond["Condition"].tolist()
    selected_conditions = st.multiselect(
        "Machine Conditions",
        options=all_conditions,
        default=all_conditions,
        help="Filter the machine condition chart"
    )

    st.markdown("---")
    st.caption("CO4031 BTL · Manufacturing DW System")

# Apply filters
filtered_dist  = failure_dist[failure_dist["Failure Type"].isin(selected_types)]
filtered_trend = monthly_trend[monthly_trend["Month Name"].isin(selected_months)]
filtered_cond  = machine_cond[machine_cond["Condition"].isin(selected_conditions)]

# ─────────────────────────────────────────────
# HEADER
# ─────────────────────────────────────────────
st.markdown(
    "<h1 style='text-align:center;'>🏭 Manufacturing Failure Analysis Dashboard</h1>",
    unsafe_allow_html=True
)
st.markdown(
    "<p style='text-align:center; color:gray;'>CO4031 BTL · Data Warehouse · Star Schema OLAP Analysis · 2023</p>",
    unsafe_allow_html=True
)
st.markdown("---")

# ─────────────────────────────────────────────
# KPI CARDS
# ─────────────────────────────────────────────
actual_failures = failure_dist[failure_dist["Failure Type"] != "No Failure"]
total_records   = failure_dist["Occurrences"].sum()
total_failures  = actual_failures["Occurrences"].sum()
avg_failure_rate = round((total_failures / total_records) * 100, 2)
most_common     = actual_failures.sort_values("Occurrences", ascending=False).iloc[0]["Failure Type"]
most_common_n   = actual_failures.sort_values("Occurrences", ascending=False).iloc[0]["Occurrences"]

k1, k2, k3, k4 = st.columns(4)
k1.metric("📦 Total Records",      f"{total_records:,}")
k2.metric("⚠️ Total Failures",     f"{total_failures:,}")
k3.metric("📉 Avg Failure Rate",   f"{avg_failure_rate}%")
k4.metric("🔴 Top Failure Type",   most_common, f"{most_common_n} cases")

st.markdown("---")

# ─────────────────────────────────────────────
# ROW 1: Failure Distribution | Monthly Trend
# ─────────────────────────────────────────────
st.subheader("📊 Failure Distribution & Monthly Trends")
col1, col2 = st.columns(2)

with col1:
    st.markdown("##### Failure Distribution by Type")
    only_failures = filtered_dist[filtered_dist["Failure Type"] != "No Failure"]
    color_map = {
        "Heat Dissipation Failure": "#EF5350",
        "Power Failure":            "#FF7043",
        "Overstrain Failure":       "#AB47BC",
        "Tool Wear Failure":        "#FFA726",
        "Random Failure":           "#78909C",
        "No Failure":               "#66BB6A",
    }
    fig1 = px.bar(
        only_failures.sort_values("Occurrences", ascending=False),
        x="Failure Type",
        y="Occurrences",
        color="Failure Type",
        color_discrete_map=color_map,
        text="Occurrences",
        labels={"Occurrences": "Count", "Failure Type": ""},
    )
    fig1.update_traces(textposition="outside", textfont_size=13)
    fig1.update_layout(
        showlegend=False,
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=20, b=10),
        xaxis=dict(tickangle=-20),
        yaxis=dict(gridcolor="#e0e0e0"),
        height=370,
    )
    st.plotly_chart(fig1, use_container_width=True)

with col2:
    st.markdown("##### Monthly Failure Trend (2023)")
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(
        x=filtered_trend["Month Name"],
        y=filtered_trend["Failures"],
        mode="lines+markers+text",
        text=filtered_trend["Failures"],
        textposition="top center",
        textfont=dict(size=11),
        line=dict(color="#1976D2", width=3),
        marker=dict(size=9, color="#1976D2", line=dict(color="white", width=2)),
        fill="tozeroy",
        fillcolor="rgba(25,118,210,0.08)",
        name="Failures",
    ))
    fig2.update_layout(
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=20, b=10),
        xaxis=dict(tickangle=-30, gridcolor="#e0e0e0"),
        yaxis=dict(title="Failure Count", gridcolor="#e0e0e0"),
        height=370,
        showlegend=False,
    )
    st.plotly_chart(fig2, use_container_width=True)

st.markdown("---")

# ─────────────────────────────────────────────
# ROW 2: Machine Condition | Quality Rate
# ─────────────────────────────────────────────
st.subheader("🔧 Machine Condition & Product Quality Analysis")
col3, col4 = st.columns(2)

with col3:
    st.markdown("##### Machine Condition vs Failure Rate")
    risk_colors = {"Low": "#66BB6A", "Medium": "#FFA726", "High": "#EF5350", "Critical": "#7B1FA2"}
    fig3 = px.scatter(
        filtered_cond,
        x="Condition",
        y="Failure Rate (%)",
        size="Failures",
        color="Risk Level",
        color_discrete_map=risk_colors,
        text="Failure Rate (%)",
        hover_data=["Operations", "Failures", "Recommended Action"],
        labels={"Failure Rate (%)": "Failure Rate (%)", "Condition": ""},
        size_max=60,
    )
    fig3.update_traces(textposition="top center", textfont_size=12)
    fig3.update_layout(
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=20, b=10),
        xaxis=dict(tickangle=-15, gridcolor="#e0e0e0"),
        yaxis=dict(gridcolor="#e0e0e0"),
        height=380,
        legend=dict(title="Risk Level", orientation="h", y=-0.25),
    )
    st.plotly_chart(fig3, use_container_width=True)

with col4:
    st.markdown("##### Failure Rate by Product Quality Type")
    quality_colors = {"Low Quality": "#EF5350", "Medium Quality": "#FFA726", "High Quality": "#66BB6A"}
    fig4 = px.bar(
        quality_rate,
        x="Product Quality",
        y="Failure Rate (%)",
        color="Product Quality",
        color_discrete_map=quality_colors,
        text="Failure Rate (%)",
        hover_data=["Total Operations", "Total Failures"],
        labels={"Failure Rate (%)": "Failure Rate (%)", "Product Quality": ""},
    )
    fig4.update_traces(
        texttemplate="%{text:.2f}%",
        textposition="outside",
        textfont_size=14,
    )
    fig4.update_layout(
        showlegend=False,
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=20, b=10),
        yaxis=dict(title="Failure Rate (%)", gridcolor="#e0e0e0", range=[0, 6]),
        height=380,
    )
    st.plotly_chart(fig4, use_container_width=True)

st.markdown("---")

# ─────────────────────────────────────────────
# ROW 3: DETAIL TABLES
# ─────────────────────────────────────────────
st.subheader("📋 Data Tables")
tab1, tab2, tab3, tab4 = st.tabs([
    "Failure Distribution", "Monthly Trend", "Machine Condition", "Product Quality"
])

with tab1:
    st.dataframe(failure_dist, use_container_width=True, hide_index=True)

with tab2:
    st.dataframe(monthly_trend, use_container_width=True, hide_index=True)

with tab3:
    st.dataframe(machine_cond, use_container_width=True, hide_index=True)

with tab4:
    st.dataframe(quality_rate, use_container_width=True, hide_index=True)
