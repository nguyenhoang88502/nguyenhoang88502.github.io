# NPI BOM Material Extraction Pipeline

## 1. Executive Summary & Business Value

The NPI BOM Material Extraction Pipeline is a low-code data integration solution built on Microsoft Power Automate that automates the extraction and weight-calculation of multi-level Bill of Materials (BOM) data from Dynamics 365 Finance & Operations. It serves the New Product Introduction (NPI) team by answering a recurring operational need: for any given item, what is the total raw material consumption — specifically ABS resin and Colorant — across all levels of its manufacturing BOM?

**Problem statement.** Prior to this solution, NPI engineers performed manual BOM explosion in Excel, traversing three levels of sub-assemblies by hand to aggregate material weights. This process was error-prone, time-consuming (approximately 45 minutes per item), and introduced version-control risk: engineers occasionally worked from stale BOM snapshots captured days or weeks earlier.

**Solution.** The pipeline queries D365 F&O via its native OData endpoint, applies server-side filters to retrieve only active, approved BOM versions, recursively traverses the BOM tree to a depth of three levels, computes cumulative ABS and Colorant weights, and persists the fully materialized result set to a SharePoint List for consumption by the NPI team.

**Business value.**

| Metric | Before | After |
|---|---|---|
| Time per item | ~45 min (manual) | < 30 sec (automated) |
| Data freshness | Snapshot (point-in-time extract) | Live query against D365 at execution time |
| Error rate | Human transcription risk | Zero — direct API-to-target writes |
| Audit trail | Individual Excel files on network drives | SharePoint List with version history and row-level timestamps |
| ERP load | Full BOM form loads in D365 client | Lightweight OData calls with `$select` and `$filter` |

**IT governance alignment.** The solution uses only standard Microsoft 365 services under the organization's existing tenant. It operates entirely within the Microsoft Entra ID identity boundary, inheriting D365's native Role-Based Access Control (RBAC). No third-party connectors, no custom middleware, and no data egress outside the Microsoft 365 compliance envelope.

---

## 2. System Architecture & Data Flow

### 2.1 High-Level Component Diagram

```
┌─────────────────────┐     OData (HTTPS)      ┌──────────────────────┐     REST API      ┌─────────────────────┐
│  Dynamics 365 F&O   │ ◄────────────────────── │   Power Automate     │ ─────────────────► │   SharePoint Online  │
│                     │                         │                      │                    │                     │
│  BOM data entities  │                         │  Scheduled / manual  │                    │  NPI_MaterialUsage  │
│  (OData endpoint)   │                         │  trigger             │                    │  List               │
└─────────────────────┘                         └──────────────────────┘                    └─────────────────────┘
                                                          │
                                                          │ Reads connector identity
                                                          ▼
                                                 ┌──────────────────────┐
                                                 │  Microsoft Entra ID  │
                                                 │  (OAuth 2.0 / SAML)  │
                                                 └──────────────────────┘
```

### 2.2 Step-by-Step Data Flow

1. **Trigger.** The flow is invoked either on-demand (manual trigger by an NPI engineer via the Power Automate portal) or on a scheduled recurrence (e.g., nightly). The trigger payload includes the parent item number(s) to process.

2. **Authentication.** Power Automate presents its configured connection identity to the D365 OData endpoint. The identity is a service principal or designated service account registered in Microsoft Entra ID, subject to the same D365 security role assignments as any interactive user.

3. **Level-1 BOM Retrieval.** The flow issues an OData `GET` request to `BOMBillOfMaterialsVersionV2Entity` filtered by `ProductNumber` and `IsActive=Microsoft.Dynamics.DataEntities.Yes`. The response returns the active BOM version header.

4. **Level-1 Line Expansion.** Using the `BOMId` from step 3, the flow queries `BOMBillOfMaterialsLineV2Entity` with `$filter=BOMId eq '{value}'` and `$select` restricted to `ItemNumber`, `BOMQty`, `BOMUnitId`, and `LineType`.

5. **Material Classification.** Each line item is evaluated:
   - If `ItemNumber` matches an ABS resin item group → record the quantity × unit weight factor.
   - If `ItemNumber` matches a Colorant item group → record the quantity × unit weight factor.
   - If the line item is itself a sub-assembly (`LineType = BOM`), the flow recurses to step 3 for that child item, up to a maximum depth of **three levels**.

6. **Weight Aggregation.** At each level, the calculated weights are summed into a running total keyed by the top-level parent item. The final payload contains:
   - Parent item number
   - Total ABS weight (kg)
   - Total Colorant weight (kg)
   - Timestamp of extraction
   - Source BOM version ID (for traceability)

7. **Write to SharePoint.** The aggregated result is upserted into the `NPI_MaterialUsage` SharePoint List. A unique constraint on `ParentItemNumber` ensures one row per item; subsequent runs update the existing row rather than creating duplicates.

### 2.3 Component Inventory

| Component | Purpose | License Requirement |
|---|---|---|
| Power Automate (flow) | Orchestration and transformation logic | Microsoft 365 E3/E5 or Power Automate per-user |
| Dynamics 365 F&O OData endpoint | Source system — BOM data | Existing D365 license (no additional cost) |
| SharePoint Online List | Target data store | Microsoft 365 E3/E5 |
| Microsoft Entra ID | Identity provider | Included with Microsoft 365 |

No additional Azure subscriptions, integration runtimes, or on-premises data gateways are required.

---

## 3. Data Entities Used

### 3.1 `BOMBillOfMaterialsVersionV2Entity`

**Purpose.** Represents the header of an approved, versioned Bill of Materials. Each row corresponds to one version of a BOM for a specific manufactured item.

**Key fields accessed by the pipeline:**

| Field | Type | Usage |
|---|---|---|
| `BOMId` | String (PK) | Primary key; used as foreign key in line queries |
| `ProductNumber` | String | The manufactured item; input parameter to the flow |
| `IsActive` | Enum (`Yes`/`No`) | Filter criterion — only active BOM versions are processed |
| `Approver` | Int64 (RecId) | Not read by flow; available for audit queries |
| `ValidFrom` / `ValidTo` | DateTime | Date-effectivity bounds; flow filters on `IsActive` only |

**OData endpoint URL pattern:**
```
https://{org}.operations.dynamics.com/data/BOMBillOfMaterialsVersionV2Entity
```

### 3.2 `BOMBillOfMaterialsLineV2Entity`

**Purpose.** Represents a single line within a BOM version — a component item, its quantity, unit of measure, and line type (item or sub-BOM).

**Key fields accessed by the pipeline:**

| Field | Type | Usage |
|---|---|---|
| `BOMId` | String (FK) | Links the line to its parent BOM version header |
| `LineNumber` | Decimal | Line position; used for deterministic ordering |
| `ItemNumber` | String | Component item; evaluated against material group membership |
| `BOMQty` | Decimal | Quantity per assembly; multiplied by unit weight for mass calculation |
| `BOMUnitId` | String | Unit of measure (e.g., `kg`, `g`, `lb`); used for unit conversion |
| `LineType` | Enum (`BOM` / `Item`) | Determines whether the flow recurses into a sub-BOM |
| `PositionNumber` | String | Logical position in BOM tree; used for debugging |

**OData endpoint URL pattern:**
```
https://{org}.operations.dynamics.com/data/BOMBillOfMaterialsLineV2Entity
```

### 3.3 Data Classification

All fields accessed are classified as **Internal — Business Operational Data** under the organization's data governance framework. The pipeline does not read or transmit personally identifiable information (PII), financial data, or customer data. No data is persisted outside the Microsoft 365 tenant boundary.

---

## 4. Security & Authentication

### 4.1 Identity Model

The pipeline operates under a **delegated identity model**. The Power Automate connection to Dynamics 365 F&O is configured with a service account or designated functional account registered in Microsoft Entra ID. Every OData call made by the flow carries an OAuth 2.0 access token bound to that identity.

### 4.2 Role-Based Access Control (RBAC)

The pipeline does **not** bypass or elevate D365 security. The service account is assigned standard D365 security roles in the same manner as any human user. The following roles are the minimum required:

| D365 Security Role | Justification |
|---|---|
| `BOMManager` or equivalent | Read access to `BOMBillOfMaterialsVersionV2Entity` and `BOMBillOfMaterialsLineV2Entity` |
| `ProductDesigner` (read-only) | Read access to released products for material group classification |

**Principle of least privilege.** The service account is granted **read-only** access to D365. It cannot create, update, or delete BOM records. The only write operation in the entire pipeline is to the SharePoint List, which resides outside the D365 boundary.

### 4.3 SharePoint List Security

The `NPI_MaterialUsage` SharePoint List is secured via the standard SharePoint permissions model:
- **NPI Engineering Group** — Contribute (read/write items)
- **Power Automate service account** — Contribute (required for upsert)
- **IT Operations** — Full Control (for schema changes and troubleshooting)
- **All other principals** — No access (broken permission inheritance from parent site, if required by policy)

### 4.4 Network & Transport Security

- All communication between components uses **HTTPS (TLS 1.2 or higher)**.
- No on-premises data gateway is involved; all traffic is cloud-to-cloud within Microsoft Azure regions.
- The D365 OData endpoint is accessed via the public internet but protected by Entra ID authentication. If the organization enforces D365 IP allow-listing, the Power Automate outbound IP ranges must be included (see [Microsoft documentation](https://learn.microsoft.com/en-us/power-automate/ip-address-configuration) for the current regional IP ranges).

### 4.5 Audit & Compliance

- Power Automate maintains a **28-day run history** with per-execution details (trigger time, duration, success/failure, connector calls).
- SharePoint List version history captures every data change at the row level, including the identity of the updating principal and the timestamp.
- D365 OData access is logged in the D365 **User Log** and **OData Request Log**, providing end-to-end traceability from the Power Automate execution back to the individual D365 entity read.

---

## 5. Performance & API Impact

### 5.1 API Consumption Model

Dynamics 365 F&O applies OData API throttling at the tenant level. The pipeline is designed to minimize API consumption through four complementary strategies:

**Server-side filtering.** All filtering logic is pushed to the D365 OData endpoint using `$filter` query parameters. The pipeline never retrieves full entity sets and filters client-side.

```
// Example: Level-1 BOM header query (server-side filter)
GET .../BOMBillOfMaterialsVersionV2Entity?
    $filter=ProductNumber eq 'ITEM-001' and IsActive eq 'Yes'
    &$select=BOMId,ProductNumber,Approver
    &$top=1
```

**Column projection (`$select`).** Only the fields listed in Section 3 are requested. The pipeline does not use `$expand` for navigation properties that would trigger N+1 queries; instead, it issues targeted follow-up queries using the primary key from the header response.

**Result-set limiting (`$top`).** Queries that expect a single result (e.g., active BOM version lookup) include `$top=1` to instruct the server to stop enumerating after the first match.

**Idempotent write patterns.** The SharePoint upsert uses a unique constraint on `ParentItemNumber` so that repeated executions of the same item do not create duplicate rows, keeping the list size proportional to the item catalog, not the execution frequency.

### 5.2 Estimated API Call Volume

For a single-item BOM extraction (worst-case: three-level BOM with 50 lines per level):

| Operation | OData Calls | Notes |
|---|---|---|
| BOM version header lookup | 1 | `$top=1`, `$filter` by ProductNumber |
| Level-1 line retrieval | 1 | Paginated if > 250 lines |
| Level-2 sub-BOM lookups | ≤ 50 | One per BOM-type line at level 1 |
| Level-3 sub-BOM lookups | ≤ 250 | One per BOM-type line at level 2 |
| SharePoint write | 1 | REST call to SharePoint API |
| **Total (worst case)** | **~302** | Typical items average 15-30 calls |

At 30 seconds per item, the sustained load on the D365 OData endpoint is approximately 10 requests per second — well within the standard throttling envelope of 600 requests per minute per tenant (documented by Microsoft).

### 5.3 Scheduling & Throttling Considerations

- Scheduled runs should be staggered outside D365 business-critical hours (e.g., 02:00–04:00 local time) if the NPI item catalog exceeds 100 items.
- The flow includes a configurable **delay between sub-BOM queries** (default: 200 ms) to avoid burst-load on the OData endpoint.
- Power Automate's built-in retry policy handles transient 429 (Too Many Requests) responses with exponential backoff.

---

## 6. Maintenance & Troubleshooting

### 6.1 Operational Ownership

| Responsibility | Owner |
|---|---|
| Power Automate flow health monitoring | IT Integration Team |
| D365 security role maintenance | D365 System Administrator |
| SharePoint List schema changes | IT Collaboration Team |
| Material group / weight factor updates | NPI Engineering Lead |
| Service account credential rotation | IT Identity & Access Management |

### 6.2 Common Failure Modes

| Symptom | Likely Cause | Resolution |
|---|---|---|
| Flow fails with `401 Unauthorized` | Service account password expired or Entra ID token issue | Rotate service account credentials; update Power Automate connection; verify Entra ID Conditional Access policy |
| Flow fails with `403 Forbidden` from D365 OData | Insufficient D365 security role; user deprovisioned | Verify `BOMManager` role assignment; check D365 User Log for access denial details |
| Flow returns zero lines for a known BOM | BOM version not active (`IsActive = No`); date effectivity window expired | Check BOM version status in D365; ensure `IsActive = Yes`; review `ValidFrom`/`ValidTo` dates |
| Missing sub-BOM data (shallow traversal) | `LineType` not mapped correctly in the flow condition | Verify the flow's condition logic distinguishes `BOM` from `Item` line types |
| SharePoint list grows unbounded | Upsert logic not working; unique constraint missing | Verify the `ParentItemNumber` column has a unique index enforced; audit flow logic for insert-vs-update branching |
| Weight totals inconsistent with D365 | Stale unit weight factors in flow configuration; unit conversion error | Cross-reference flow weight factors against D365 released product attributes; validate unit-of-measure conversion logic |

### 6.3 Monitoring & Alerting

- **Power Automate built-in analytics.** The Power Platform Admin Center provides run history, error rates, and average duration. Configure a daily digest email for flow failures.
- **SharePoint List alerts.** Configure a SharePoint alert on the `NPI_MaterialUsage` List to notify the NPI team when new rows are added or existing rows are modified.
- **D365 OData telemetry.** D365 F&O administrators can query the `SysODataRequestLog` table to audit OData request volume, latency, and error responses originating from the pipeline's service account.

### 6.4 Recovery Procedures

**Flow execution failure.** Re-run the flow from the Power Automate portal. The upsert pattern is idempotent — partial writes from a failed run will be overwritten, not duplicated.

**SharePoint List corruption.** Restore from the SharePoint recycle bin (first-stage or second-stage) or from a documented backup. The pipeline can fully rebuild the list by executing a bulk run against all active items.

**D365 OData endpoint unavailability.** The flow will fail gracefully and can be re-triggered. No data loss occurs because the pipeline is read-only with respect to D365. If the outage exceeds the SLA window, escalate via the standard D365 support channel.

### 6.5 Configuration Parameters

The following parameters are maintained within the Power Automate flow definition and should be documented in the organization's configuration management database (CMDB):

| Parameter | Default | Description |
|---|---|---|
| `MaxBOMDepth` | 3 | Maximum recursion depth for sub-BOM traversal |
| `ABSItemGroup` | `ABS_RAW` | D365 item group identifier for ABS resin materials |
| `ColorantItemGroup` | `COLORANT` | D365 item group identifier for colorant materials |
| `ODataTopThreshold` | 250 | Page size for OData line queries |
| `SubBOMDelayMs` | 200 | Delay between sequential sub-BOM queries (throttling control) |
| `SharePointSiteUrl` | (tenant-specific) | Base URL of the SharePoint site hosting the target list |
| `SharePointListName` | `NPI_MaterialUsage` | Display name of the target SharePoint List |

---

## 7. Change Management

Any modification to the Power Automate flow, SharePoint List schema, or D365 security role assignments must follow the organization's standard change control process. Specific triggers for change review include:

- Addition of new material types beyond ABS and Colorant
- Change to the maximum BOM traversal depth
- Modification of the OData query patterns (e.g., adding `$expand`)
- Service account credential rotation
- SharePoint List column additions or data type changes

All changes should be tested in a non-production D365 environment (UAT or Sandbox) before promotion to production.

---

*Document version: 1.0 | Prepared for IT Security & Architecture Review | Last updated: 2026-05-13*
