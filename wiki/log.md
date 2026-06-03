# CivicSecondBrain Operation Log
> Append-only. Never edit existing entries.
>
> Grep patterns:
>   All entries:  grep "^## [" wiki/log.md
>   All ingests:  grep "INGEST" wiki/log.md
>   Last 10:      grep "^## [" wiki/log.md | tail -10

---

## [2026-06-03] BOOTSTRAP | CivicSecondBrain initial scaffold
**Scope:** Full project scaffold for Schertz, TX City Council AI Assistant
**Files created:**
- wiki/SCHEMA.md (governing document)
- wiki/index.md (navigation catalog, empty)
- wiki/log.md (this file)
- wiki/topics/ (7 topic stubs pending first INGEST)
- wiki/decisions/ (populated per meeting after INGEST)
- wiki/people/ (pending first INGEST)
- wiki/recommendations/ (populated by nightly LINT)
- wiki/queries/ (populated on demand)
**Data source configured:** https://www.schertz.com/27/Government
**Next action:** Run `npm run ingest:seed` to process initial Schertz document corpus

## [2026-06-03] INGEST-BATCH | Schertz seed ingestion
**Sources processed:** 6
**Succeeded:** 0 | **Failed:** 6
**Elapsed:** 8s
**Manifest:** ./raw-sources/manifest.json
**Top themes:** Initial bootstrap of Schertz, TX civic document corpus
**Data source:** https://www.schertz.com/27/Government

## [2026-06-03] INGEST-BATCH | Schertz seed ingestion
**Sources processed:** 3
**Succeeded:** 0 | **Failed:** 3
**Elapsed:** 79s
**Manifest:** ./raw-sources/manifest.json
**Top themes:** Initial bootstrap of Schertz, TX civic document corpus
**Data source:** https://www.schertz.com/27/Government

## [2026-06-03] INGEST-BATCH | Schertz seed ingestion
**Sources processed:** 3
**Succeeded:** 0 | **Failed:** 3
**Elapsed:** 15s
**Manifest:** ./raw-sources/manifest.json
**Top themes:** Initial bootstrap of Schertz, TX civic document corpus
**Data source:** https://www.schertz.com/27/Government

## [2026-06-03] INGEST-BATCH | Schertz seed ingestion
**Sources processed:** 3
**Succeeded:** 0 | **Failed:** 3
**Elapsed:** 19s
**Manifest:** ./raw-sources/manifest.json
**Top themes:** Initial bootstrap of Schertz, TX civic document corpus
**Data source:** https://www.schertz.com/27/Government

## [2026-06-03] INGEST-BATCH | Schertz seed ingestion
**Sources processed:** 3
**Succeeded:** 0 | **Failed:** 3
**Elapsed:** 14s
**Manifest:** ./raw-sources/manifest.json
**Top themes:** Initial bootstrap of Schertz, TX civic document corpus
**Data source:** https://www.schertz.com/27/Government

## [2026-06-03] INGEST-BATCH | Schertz seed ingestion
**Sources processed:** 3
**Succeeded:** 0 | **Failed:** 3
**Elapsed:** 186s
**Manifest:** ./raw-sources/manifest.json
**Top themes:** Initial bootstrap of Schertz, TX civic document corpus
**Data source:** https://www.schertz.com/27/Government

## [2026-06-03] INGEST | City Charter 2024
**Source:** https://www.schertz.com/DocumentCenter/View/13333/City-of-Schertz-City-Charter-2024
**Document type:** charter
**Pages updated:** none
**Pages created:** topics/governance.md, topics/ordinances.md, topics/budget.md, topics/strategic-plan.md, topics/development.md
**Key facts added:** This is the complete City Charter for Schertz, Texas, adopted by voters on November 5, 2024. The Charter establishes a council-manager form of government with a Mayor and seven Council members elected at-large for three-year terms. It defines the powers and structure of city government, including the role of the City Manager as chief administrative officer, establishes financial procedures with a fiscal year beginning October 1, and provides for citizen initiative, referendum, and recall rights. The Charter replaces previous versions dating back to the original adoption and subsequent amendments through 2015.
**Ordinances referenced:** 15-M-15, 15-M-41
**Dollar amounts found:** Maximum criminal penalty fine for Charter violations: 500; Maximum civil penalty fine for Charter violations: 500; Candidate filing fee: 5
**Votes recorded:** 1

## [2026-06-03] INGEST | Strategic Plan 2024-2025
**Source:** https://www.schertz.com/DocumentCenter/View/12694/City-of-Schertz-Strategic-Plan-2024-25
**Document type:** strategic-plan
**Pages updated:** topics/strategic-plan.md, topics/governance.md, topics/budget.md, topics/development.md
**Pages created:** topics/infrastructure.md, topics/public-safety.md
**Key facts added:** This is the City of Schertz Strategic Plan for 2024-2025, establishing the city's vision, mission, and strategic priorities for the two-year period. The plan outlines key focus areas and goals that will guide city operations and resource allocation. It serves as a roadmap for city leadership and staff to align efforts toward common objectives. The strategic plan was developed with input from city council, staff, and community stakeholders. This document provides the framework for measuring progress and accountability in achieving the city's long-term vision.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | 2026 Master Calendar
**Source:** https://www.schertz.com/DocumentCenter/View/13925/2026-City-of-Schertz-Master-Calendar
**Document type:** agenda
**Pages updated:** topics/governance.md, topics/budget.md, topics/strategic-plan.md, topics/development.md
**Pages created:** none
**Key facts added:** This is the 2026 Master Calendar for the City of Schertz, outlining all scheduled City Council meetings, board and commission meetings, city holidays, and special events throughout the year. The calendar includes regular meeting schedules for various bodies including City Council, Planning & Zoning, Parks & Recreation Advisory Board, Economic Development Corporation, and multiple other committees. It also lists city office closures for holidays, community events like the July 4th Jubilee and National Night Out, and strategic planning sessions including budget retreats scheduled for January, March, and July.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST-BATCH | Schertz seed ingestion
**Sources processed:** 3
**Succeeded:** 3 | **Failed:** 0
**Elapsed:** 164s
**Manifest:** ./raw-sources/manifest.json
**Top themes:** Initial bootstrap of Schertz, TX civic document corpus
**Data source:** https://www.schertz.com/27/Government

## [2026-06-03] INGEST | Adopted Budget FY2025-26
**Source:** https://www.schertz.com/DocumentCenter/View/13847
**Document type:** budget
**Pages updated:** topics/budget.md, topics/infrastructure.md, topics/public-safety.md, topics/development.md, topics/governance.md, topics/strategic-plan.md
**Pages created:** none
**Key facts added:** The City of Schertz adopted its FY2025-26 Annual Budget totaling $272,679,332, including an Operating Budget of $140,762,098 and a Capital Budget of $72,517,234. The budget centers on five key priorities: staff compensation, street maintenance and repair, capital improvement program advancement, increasing staffing levels, and new/remodeled facilities. The property tax rate was increased to $0.5118 per $100 valuation (a 1.1% increase). The budget adds 26 new positions citywide and includes a 1% across-the-board wage increase plus merit/step programs. Key challenges addressed include the Disabled Veterans Homestead Exemption impact ($5.5 million in foregone revenue), EMS funding deficits, and drainage system capacity needs.
**Ordinances referenced:** none
**Dollar amounts found:** Total Adopted Budget: 272679332; Operating Budget: 140762098; Capital Budget: 72517234; General Fund Total Revenues: 52815416; Property Tax Revenue (General Fund): 21734288; Sales Tax Revenue (General Fund): 15485000; Interest & Sinking Fund Property Tax: 10270000; Disabled Veterans Homestead Exemption Impact: 5500000; DVHS Exempt Property Value: 7080000000; Street Maintenance (General Fund): 650000; Street Projects (bonds, SEDC, grants): 53889496; Traffic Safety and Sidewalk Improvements: 415000; Merit/Step Program Cost: 784000; Fire Station 4 Annual Operating Impact: 1300000; Water & Sewer Fund Total Revenues: 35391478; EMS Fund Total Revenues: 17060386; Drainage Fund Total Revenues: 2316283; SEDC Fund Total Revenues: 8928608; Wendy Swan Drainage Improvements: 1100000; FM 1518 City Park Underground Drainage Upgrade: 45000
**Votes recorded:** 5

## [2026-06-03] QUERY | Summarize the most recent city council meeting
**Question:** Summarize the most recent city council meeting
**Wiki pages read:** topics/governance.md, topics/public-safety.md, topics/infrastructure.md, topics/development.md, topics/strategic-plan.md, topics/budget.md, topics/ordinances.md
**Filed:** not filed
**Gap noted:** none

## [2026-06-03] INGEST | Adopted Budget FY2024-25
**Source:** https://www.schertz.com/DocumentCenter/View/13068
**Document type:** budget
**Pages updated:** topics/budget.md, topics/ordinances.md, topics/infrastructure.md, topics/public-safety.md, topics/development.md, topics/governance.md, topics/strategic-plan.md
**Pages created:** none
**Key facts added:** The City of Schertz adopted budget for fiscal year 2024-25 totals $132,189,127 in expenditures across all funds, with $49,993,629 in General Fund revenues. The budget includes a property tax rate increase to $0.4900 per $100 valuation, representing a 5.1% increase in total property tax revenue ($1,345,617). Key initiatives include a 3.5% across-the-board salary increase based on the Bureau of Labor Statistics Employer Cost Index, continued street maintenance improvements with $3.1 million allocated, and implementation of a comprehensive 10-year Capital Improvement Program. The budget maintains essential services while addressing infrastructure needs and staffing requirements across departments.
**Ordinances referenced:** none
**Dollar amounts found:** Total Budget - All Funds Expenditures: 132189127; General Fund Revenues: 49993629; General Fund Expenditures: 52589778; Property Tax Revenue Increase: 1345617; Certificates of Obligation for Street Projects: 20000000; Water & Sewer Fund Revenues: 32860415; Water & Sewer Fund Expenditures: 35011333; EMS Fund Revenues: 15070944; Economic Development Corporation Revenues: 8343000; Interest & Sinking Fund Revenues: 9710920; Total Debt Obligation Secured by Property Taxes: 88054065; Street Maintenance and Repair Budget: 3118351; Police Department Budget: 13602271; Fire Rescue Budget: 10085401; Parks, Recreation & Community Services Budget: 2502218; General Fund Balance Target: 9896131; Capital Recovery Roadways Area 3 - Total Revenues FY2024-25: 425250; Capital Recovery Roadways Area 3 - Ending Fund Balance FY2024-25: 1903192; Capital Recovery Roadways Area 4 - Total Revenues FY2024-25: 3315; Library Fund - Total Revenues FY2024-25: 21500; Library Fund - Ending Fund Balance FY2024-25: 71653; Historical Committee - Total Revenues FY2024-25: 14250; Historical Committee - General Fund Transfer FY2024-25: 10750; Total General Fund Debt Service FY2025-2042: 96191343; Water/Wastewater Debt Service FY2025: 2591411; Schertz-Seguin LGC Debt Service FY2025: 8116003
**Votes recorded:** 4

## [2026-06-03] INGEST | Adopted Budget FY2023-24
**Source:** https://www.schertz.com/DocumentCenter/View/9601
**Document type:** budget
**Pages updated:** topics/budget.md, topics/ordinances.md, topics/infrastructure.md, topics/public-safety.md, topics/development.md, topics/governance.md, topics/strategic-plan.md
**Pages created:** none
**Key facts added:** The City of Schertz adopted budget for FY2023-24 totals $118.8 million in expenditures across all funds, with revenues of $114.9 million. The property tax rate is set at $0.4950 per $100 valuation, representing a 9.9% increase in total property tax revenue from the prior year ($2.4 million increase). The budget includes a 4.7% Employment Cost Index adjustment for all staff effective October 2023, plus an anticipated $1.9 million wage adjustment in January 2024 based on a Classification & Compensation Study. Major capital investments include $1 million for street improvements, replacement of police body cameras/in-car cameras/TASERs ($550k annual lease), and construction of Fire Station #4. The General Fund maintains a 29% fund balance reserve (above the 26% policy target).
**Ordinances referenced:** none
**Dollar amounts found:** Total All Funds Expenditures: 118824547; Total All Funds Revenues: 114960769; General Fund Expenditures: 49954992; General Fund Revenues: 47390488; Property Tax Revenue Increase: 2398167; Classification & Compensation Study Implementation: 1900000; Street Improvements One-Time Funding: 1000000; Police Camera/TASER Replacement Lease: 550000; Total Debt Obligation: 96572010; Water & Sewer Fund Revenues: 31504800; Water & Sewer Fund Expenditures: 31241901; EMS Fund Revenues: 12860223; EMS Fund Expenditures: 13640836; Debt Service Fund Revenues: 9335000; Economic Development Corporation Revenues: 8407000; Taxable Property Valuation: 5440641228
**Votes recorded:** 3

## [2026-06-03] INGEST | Adopted Budget FY2022-23
**Source:** https://www.schertz.com/DocumentCenter/View/8193
**Document type:** budget
**Pages updated:** topics/budget.md, topics/ordinances.md, topics/infrastructure.md, topics/public-safety.md, topics/development.md, topics/governance.md
**Pages created:** none
**Key facts added:** This is the City of Schertz's adopted budget for fiscal year 2022-23, covering October 1, 2022 through September 30, 2023. The budget was approved by City Council with members Mark Davis, Jill Whittaker, Michael Dahle, David Scagliola, Allison Heyward, and Tim Brown voting in favor. The budget includes a property tax rate of $0.4950/$100, down from the prior year's $0.5121/$100. The total budget across all funds is $108,549,921 in revenues and $103,873,320 in expenditures. The General Fund represents $44,376,036 in revenues with major increases in property and sales tax collections.
**Ordinances referenced:** none
**Dollar amounts found:** Total budget revenues all funds: 108549921; Total budget expenditures all funds: 103873320; General Fund revenues: 44376036; General Fund expenditures: 44376041; Property tax revenue increase: 2541687; New property tax revenue: 576517; Total debt obligation secured by property taxes: 105316557; Interest & Sinking Fund revenues: 8686248; Interest & Sinking Fund expenditures: 8686248; Water & Sewer Fund revenues: 28485858; Water & Sewer Fund expenditures: 26826741; Drainage Fund revenues: 1450073; EMS Fund revenues: 11720981; Economic Development Corporation revenues: 10050960; Street Preservation and Maintenance (SPAM) increase: 250000; Certificates of Obligation Series 2019 - General Fund Component - Total Principal: 3510000; Certificates of Obligation Series 2019 - General Fund Component - Total Interest: 905763; Certificates of Obligation Series 2019 - Utility Fund Component - Total Principal: 3225000; Certificates of Obligation Series 2019 - Utility Fund Component - Total Interest: 988975; General Obligation Refunding Bonds Series 2020 - Total Principal: 7555000; General Obligation Refunding Bonds Series 2020 - Total Interest: 1082244; General Obligation Refunding Bonds Series 2021 - General Fund Component - Total Principal: 4070000; General Obligation Refunding Bonds Series 2021 - General Fund Component - Total Interest: 707050; General Obligation Refunding Bonds Series 2021 - Utility Fund Component - Total Principal: 1945000; Certificates of Obligation Series 2022 - Total Principal: 4740000; Certificates of Obligation Series 2022 - Total Interest: 1504487.5; Certificates of Obligation Series 2022 - General Fund Component - Total Principal: 4650000; Certificates of Obligation Series 2022A - General Fund Component - Total Principal: 8265000; Certificates of Obligation Series 2022A - General Fund Component - Total Interest: 4060850; Certificates of Obligation Series 2022A - Utility Fund Component - Total Principal: 10265000; Certificates of Obligation Series 2022A - Utility Fund Component - Total Interest: 5040775; General Obligation Bonds Series 2022 - Total Principal: 18535000; General Obligation Bonds Series 2022 - Total Interest: 9101625; Total Schertz Debt Obligations Through FY2051: 202829454
**Votes recorded:** 2

## [2026-06-03] INGEST | Schertz Tax Rates
**Source:** https://www.schertz.com/DocumentCenter/View/8468/Schertz-Tax-Rates
**Document type:** financial-report
**Pages updated:** topics/budget.md, topics/governance.md
**Pages created:** none
**Key facts added:** This document provides a comprehensive overview of current tax rates for the City of Schertz across three counties (Guadalupe, Bexar, and Comal). It details sales tax rates totaling 8.25%, property tax rates per $100 of taxable value which vary by county and taxing entity, and hotel occupancy tax rates. The property tax rates were set in September 2025 for taxes due January 2026, with the City of Schertz maintaining a consistent rate of $0.5118 per $100 across all three counties.
**Ordinances referenced:** none
**Dollar amounts found:** City of Schertz property tax rate per $100 of taxable value (all counties): 0.5118; Total sales tax per $1 taxable purchase: 0.0825; City of Schertz sales tax per $1 taxable purchase: 0.01; Schertz Economic Development sales tax per $1 taxable purchase: 0.005; Guadalupe County property tax rate per $100: 0.2784; Schertz-Cibolo-Universal City ISD property tax rate per $100: 1.0769; Bexar County property tax rate per $100: 0.276331; East Central ISD property tax rate per $100: 0.9319; Comal County property tax rate per $100: 0.269; Comal Independent School District property tax rate per $100: 1.0748
**Votes recorded:** 0

## [2026-06-03] INGEST | FY 2021-22 Adopted Budget
**Source:** https://www.schertz.com/DocumentCenter/View/7759/FY-2021-22-Approved-Budget
**Document type:** budget
**Pages updated:** topics/budget.md, topics/public-safety.md, topics/infrastructure.md, topics/governance.md, topics/development.md, topics/ordinances.md, topics/strategic-plan.md
**Pages created:** none
**Key facts added:** The FY 2021-22 Adopted Budget for Schertz, TX was approved unanimously by City Council. The budget totals $97.3M in revenues across all funds, with $91.2M in expenditures. The property tax rate remains at $0.5121 per $100 valuation, unchanged from the prior year. General Fund revenues increase 7.4% to $39.3M, driven by property and sales tax growth. Major initiatives include implementing a classification and compensation study, raising minimum wage to $15/hour, replacing financial software ($500K), and upgrading the Animal Adoption Center HVAC ($350K).
**Ordinances referenced:** none
**Dollar amounts found:** Total revenues all funds: 97335056; Total expenditures all funds: 91165701; General Fund revenues: 39314984; General Fund expenditures: 39106440; Property tax revenue: 27560000; Sales tax revenue: 10850000; Total debt obligation secured by property taxes: 66084539; Financial software replacement: 500000; Animal Adoption Center HVAC replacement: 350000; Water & Sewer Fund revenues: 28382723; Water & Sewer Fund expenditures: 25014310; EMS revenues: 9785424; EMS expenditures: 9732293; SEDC sales tax revenues: 4507371; SEDC transfer from reserves: 3496428; Police Department budget: 10295516; Fire Rescue budget: 6614057; Parks, Recreation & Community Services budget: 1661936; Library budget: 1161611; Streets Department budget: 1926970; Drainage Fund revenues: 1445564; Classification & Compensation Study ECI adjustment: 52750; General Obligation Refunding Series 2018 - Total Debt Service: 4685561; Certificates of Obligation Series 2018 - General Fund Total: 5511675; Certificates of Obligation Series 2018 - Water & Sewer Total: 6760019; General Obligation and Refunding Bonds Series 2018 - General Fund: 5886378; General Obligation and Refunding Bonds Series 2018 - Utility Fund: 2322125; Certificates of Obligation Series 2019 - General Fund: 4415763; Certificates of Obligation Series 2019 - Utility Fund: 4213975; General Obligation Refunding Bonds Series 2020: 8637244; General Obligation Refunding Bonds Series 2021 - General Fund: 4777050; General Obligation Refunding Bonds Series 2021 - Utility Fund: 2293913; Schertz/Seguin Local Government Corporation Contract Revenue Bonds - Total: 253321852; FY2021-22 Total Debt Service Payment: 8490473
**Votes recorded:** 3

## [2026-06-03] INGEST | FY 2020-21 Adopted Budget
**Source:** https://www.schertz.com/DocumentCenter/View/6733
**Document type:** budget
**Pages updated:** topics/budget.md, topics/governance.md, topics/public-safety.md, topics/infrastructure.md, topics/development.md, topics/strategic-plan.md
**Pages created:** none
**Key facts added:** The FY 2020-21 Adopted Budget for Schertz, TX was approved by City Council with a vote of 6-1 (Councilmember Scagliola against). The total General Fund budget is $37.47 million with revenues increasing 4.8% and expenditures increasing 7.1%. The property tax rate decreased slightly to $0.5121/$100 from $0.5146/$100, though total property tax revenue will increase by $777,223 (3.9%) due to new property added to the tax rolls. The budget includes $386,000 for new positions in Police, Fire, and Planning & Zoning, implements the first year of a Classification & Compensation Study with a 1% Employment Cost Index adjustment for all employees ($211,000), and allocates $400,000 for a Comprehensive Land Use Plan and Unified Development Code update.
**Ordinances referenced:** SEDC Resolution 2019-7
**Dollar amounts found:** Total General Fund Budget: 37474811; General Fund Revenue: 37474811; Property Tax Revenue Increase: 777223; New property tax revenue from new properties: 613162; Total debt obligation secured by property taxes: 75077338; New personnel positions: 386000; Classification & Compensation Study ECI adjustment: 211000; Comprehensive Land Use Plan and Unified Development Code update: 400000; Facilities Maintenance increase: 55000; Transfer from fund balance for capital projects: 500000; Police Department Budget: 10172678; Fire Rescue Budget: 6150356; Interest & Sinking Fund Revenue: 7095821; Interest & Sinking Fund Expenditures: 7094861; Water & Sewer Fund Revenue: 25504368; Water & Sewer Fund Expenditures: 24738545; Drainage Fund total revenues FY 2020-21: 1445564; Drainage Fund total expenditures FY 2020-21: 1445564; EMS Fund total revenues FY 2020-21: 9785425; EMS Fund total expenditures FY 2020-21: 9732293; Economic Development Corporation sales tax revenue FY 2020-21: 4507371; Main Street infrastructure improvements allocation: 4050000; Hotel/Motel Occupancy Tax Fund revenues FY 2020-21: 540750; Park Fund capital outlay FY 2020-21: 100000; EMS bad debt expense FY 2020-21: 2510227; Schertz support payment for EMS: 667049; Cibolo support payment for EMS: 473115; Seguin/Guadalupe County support for EMS: 843577; PEG Fund total budget FY 2020-21: 185500; Tree Mitigation Fund maintenance services: 70000
**Votes recorded:** 2

## [2026-06-03] INGEST | Financial Summary and Charts
**Source:** https://www.schertz.com/DocumentCenter/View/162
**Document type:** financial-report
**Pages updated:** topics/budget.md, topics/governance.md
**Pages created:** topics/financial-report.md
**Key facts added:** This financial transparency report presents the City of Schertz's fiscal year 2019 financial summary based on the government-wide Statement of Activities using accrual accounting. The report shows total revenues of $81.2 million ($2,311 per capita) and total expenses of $70.3 million ($2,002 per capita), resulting in a change in net position of $10.8 million. The document includes detailed breakdowns of governmental and business-type activities, historical comparisons from 2012-2019, and key metrics including 357 full-time equivalent positions, a population of 35,121, and a property tax rate of $0.5146 per $100 valuation.
**Ordinances referenced:** none
**Dollar amounts found:** Total Governmental Activities Revenues and Transfers: 44056014; Total Business-type Activities Revenues and Transfers: 37110146; Total Revenues: 81166160; Governmental Activities Expenses: 38186344; Business-type Activities Expenses: 32138021; Total Expenses: 70324365; Change in Net Position: 10841795; Ad Valorem Tax Revenue: 19151005; Sales Tax Revenue: 12506879; Franchise Fees: 2357150; Hotel/Motel Tax Revenue: 514679; Investment Earnings - Governmental: 1470258; Investment Earnings - Business-type: 855216
**Votes recorded:** 0

## [2026-06-03] INGEST-BATCH | Schertz seed ingestion
**Sources processed:** 9
**Succeeded:** 8 | **Failed:** 1
**Elapsed:** 1458s
**Manifest:** ./raw-sources/manifest.json
**Top themes:** Initial bootstrap of Schertz, TX civic document corpus
**Data source:** https://www.schertz.com/27/Government
