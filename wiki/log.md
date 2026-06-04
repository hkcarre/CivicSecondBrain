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

## [2026-06-03] QUERY | Summarize the most recent city council meeting
**Question:** Summarize the most recent city council meeting
**Wiki pages read:** topics/governance.md, topics/financial-report.md, topics/public-safety.md, topics/infrastructure.md, topics/development.md, topics/strategic-plan.md, topics/budget.md, topics/ordinances.md
**Filed:** not filed
**Gap noted:** none

## [2024-10-01] Ingested budget.pdf

## [2024-10-01] First entry

## [2024-10-02] Second entry

## [2026-06-03] INGEST-BATCH | Schertz seed ingestion
**Sources processed:** 1
**Succeeded:** 0 | **Failed:** 1
**Elapsed:** 74s
**Manifest:** ./raw-sources/manifest.json
**Top themes:** Initial bootstrap of Schertz, TX civic document corpus
**Data source:** https://www.schertz.com/27/Government

## [2026-06-03] INGEST | City Charter 2024
**Source:** https://www.schertz.com/DocumentCenter/View/13333/City-of-Schertz-City-Charter-2024
**Document type:** charter
**Pages updated:** topics/governance.md, topics/ordinances.md, topics/budget.md
**Pages created:** none
**Key facts added:** This is the 2024 Home Rule Charter for the City of Schertz, Texas, adopted by voters on November 5, 2024. It establishes the city's form of government with a Mayor-Council system and appointed City Manager, defines city powers, boundaries, and organizational structure. The Charter details the composition of the City Council (Mayor and seven Council members elected at-large for three-year terms), procedures for meetings and ordinances, financial procedures, and provisions for initiative, referendum, and recall. It also includes general provisions for charter amendments, conflict of interest rules, and disaster procedures.
**Ordinances referenced:** 15-M-15, 15-M-41
**Dollar amounts found:** Maximum criminal fine for charter violations: 500; Maximum civil fine for charter violations: 500; Candidate filing fee: 5
**Votes recorded:** 1

## [2026-06-03] INGEST | Strategic Plan 2024-2025
**Source:** https://www.schertz.com/DocumentCenter/View/12694/City-of-Schertz-Strategic-Plan-2024-25
**Document type:** strategic-plan
**Pages updated:** topics/strategic-plan.md, topics/governance.md, topics/budget.md, topics/infrastructure.md, topics/public-safety.md, topics/development.md
**Pages created:** none
**Key facts added:** This is the City of Schertz Strategic Plan for fiscal years 2024-2025. The document outlines the city's vision, mission, and strategic priorities for the two-year period. It establishes goals and objectives across multiple focus areas to guide city operations and decision-making. The plan serves as a roadmap for achieving the community's desired outcomes and measuring progress toward long-term objectives.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | 2026 Master Calendar
**Source:** https://www.schertz.com/DocumentCenter/View/13925/2026-City-of-Schertz-Master-Calendar
**Document type:** agenda
**Pages updated:** topics/governance.md, topics/budget.md, topics/strategic-plan.md, topics/development.md
**Pages created:** none
**Key facts added:** This is Schertz's 2026 Master Calendar, which serves as a comprehensive scheduling document for all city council meetings, board and commission meetings, city holidays, and special events throughout the year. The calendar includes the regular meeting schedules for City Council (1st and 3rd Tuesdays), Planning & Zoning, Parks & Recreation Advisory Board, Economic Development Corporation, and numerous other advisory bodies. It also marks important city events like Polar Bear 5K, National Night Out, and community celebrations, as well as official city holidays when offices are closed. The document provides specific meeting locations, times, and notes exceptions or rescheduled meetings throughout the year.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | Adopted Budget FY2025-26
**Source:** https://www.schertz.com/DocumentCenter/View/13847
**Document type:** budget
**Pages updated:** topics/budget.md, topics/infrastructure.md, topics/public-safety.md, topics/development.md, topics/governance.md, topics/strategic-plan.md
**Pages created:** none
**Key facts added:** The City of Schertz adopted its annual budget for FY2025-26 (October 1, 2025 - September 30, 2026) totaling $272,679,332, including an Operating Budget of $740,762,098 and a Capital Budget of $72,517,234. The budget focuses on five key priorities: staff compensation, street maintenance and repair, capital improvement program (CIP), increasing staffing levels, and new/remodeled facilities. The property tax rate increased 1.1% to $0.5118 per $100 of valuation. The budget adds 26 new positions citywide and addresses challenges including Disabled Veterans Homestead Exemption impacts, EMS funding gaps, and drainage infrastructure needs.
**Ordinances referenced:** none
**Dollar amounts found:** Total Combined Budget: 272679332; Operating Budget: 740762098; Capital Budget: 72517234; General Fund Total Revenues: 52815416; Property Tax Revenue: 32004288; Sales Tax Revenue: 23153608; Water & Sewer Fund Revenue: 35391478; Disabled Veterans Homestead Exemption Impact: 5500000; DVHS Exempt Property Value: 7080000000; Street Maintenance (General Fund): 650000; Street Projects (Bond/SEDC/Grants): 53889496; Merit/Step Program: 784000; Traffic Safety and Sidewalk Improvements: 415000; Fire Station 4 Staffing Impact: 1300000; EMS Fund Revenue: 17060386; Drainage Fund Revenue: 2316283; SEDC Fund Revenue: 8928608
**Votes recorded:** 5

## [2026-06-03] INGEST | Adopted Budget FY2024-25
**Source:** https://www.schertz.com/DocumentCenter/View/13068
**Document type:** budget
**Pages updated:** topics/budget.md, topics/ordinances.md, topics/infrastructure.md, topics/public-safety.md, topics/development.md, topics/governance.md, topics/strategic-plan.md
**Pages created:** none
**Key facts added:** The City of Schertz adopted budget for FY2024-25 totals $132.2 million in expenditures across all funds, with revenues of $122.3 million. The General Fund budget is $52.6 million. The budget includes a 3.5% across-the-board salary increase based on the Bureau of Labor Statistics Employer Cost Index, though lower than the 5.1% ECI to align with revenue projections. The property tax rate increases to $0.4900 per $100 valuation, with the M&O portion at $0.3326 and I&S portion at $0.1574. The budget maintains essential services while addressing infrastructure needs, including $1 million for street maintenance and a comprehensive Capital Improvement Program. New positions include an EMS Battalion Chief, 5 Water/Sewer Workers, and a Meter Technician.
**Ordinances referenced:** none
**Dollar amounts found:** Total budget expenditures all funds: 132189127; Total revenues all funds: 122269356; General Fund expenditures: 52589778; General Fund revenues: 49993629; Property tax increase: 1345617; Total debt obligation secured by property taxes: 88054065; Water and Sewer Fund expenditures: 35011333; Police Department budget: 13602271; Fire Rescue budget: 10085401; EMS Fund budget: 15371822; Economic Development Corporation budget: 16668840; Street maintenance allocation: 1000000; Certificates of Obligation to be issued: 20000000; Taxable assessed property value: 5645026665; Fund 433 Total Revenues FY2024-25: 425250; Fund 433 Ending Fund Balance FY2024-25: 1903192; Fund 434 Total Revenues FY2024-25: 3315; Library Fund Total Budget FY2024-25: 21500; Historical Committee Total Budget FY2024-25: 14250; Total General Fund Supported Debt Service FY2025: 8148590; Total Water and Wastewater Debt Service FY2025: 2591411; Total Schertz-Seguin LGC Debt Service FY2025: 8116003; General Fund unreserved fund balance policy: null; Debt Service Fund balance policy: null; Capital project threshold for CIP: 100000; Capitalization threshold for tangible assets: 5000; Historical Committee transfer from General Fund: 10750
**Votes recorded:** 8

## [2026-06-03] QUERY | What is the current total city debt and debt per c
**Question:** What is the current total city debt and debt per capita?
**Wiki pages read:** topics/budget.md, topics/financial-report.md, topics/public-safety.md, topics/infrastructure.md, topics/development.md, topics/strategic-plan.md, topics/ordinances.md, topics/governance.md
**Filed:** not filed
**Gap noted:** none

## [2026-06-03] LINT | full
**Pages analyzed:** 13
**Issues found:** 3 high | 4 medium | 1 low
**Stale pages:** wiki/decisions/2024/council.md — Last updated Sept 2024 (9 months old); contains only '$42M general fund budget' without context or vote breakdown, wiki/decisions/2024-01-10-city-council.md — Last updated Jan 2024 (17 months old); generic '5-0 vote to approve ordinance' with no ordinance number or subject, wiki/decisions/2024-02-01-planning-&-zoning-board.md — Last updated Jan 2024 (17 months old); contains only placeholder text 'Content.', wiki/topics/financial-report.md — Last updated June 2, 2026, but contains only FY2019 data (7-year-old financials); no FY2020-2025 annual reports ingested
**Recommendations generated:** recommendations/2026-06-03-disabled-veterans-homestead-exemption-dvhs-crisis-threatens-fiscal-sustainability.md, recommendations/2026-06-03-accelerating-debt-burden-without-comprehensive-debt-management-policy.md, recommendations/2026-06-03-fund-balance-erosion-below-policy-target-signals-budget-structural-imbalance.md, recommendations/2026-06-03-street-maintenance-funding-inadequate-for-growing-infrastructure-liability.md, recommendations/2026-06-03-ems-funding-model-unsustainable-without-regional-cost-sharing-reform.md, recommendations/2026-06-03-sales-tax-revenue-growth-slowing-without-economic-development-diversification-strategy.md, recommendations/2026-06-03-strategic-plan-lacks-measurable-performance-metrics-and-progress-reporting.md, recommendations/2026-06-03-drainage-fund-expansion-lacks-stormwater-utility-fee-policy-and-master-plan.md
**Top 3 recommended actions:**
  1. CRITICAL: Develop three-scenario DVHS fiscal impact model (FY2026-2030) and brief Council by September 2026 on revenue mitigation strategies including state lobbying coalition and potential service reductions.
  2. HIGH PRIORITY: Adopt formal Debt Management Policy by December 2026 with debt service ratio caps, per-capita limits, and mandatory affordability analysis for all bond/CO issuances.
  3. URGENT: Freeze non-essential General Fund hiring until fund balance returns to 26% target; commission zero-based budget review to identify 3-5% recurring savings by March 2027.

## [2026-06-03] INGEST | Adopted Budget FY2022-23
**Source:** https://www.schertz.com/DocumentCenter/View/8193
**Document type:** budget
**Pages updated:** topics/budget.md, topics/infrastructure.md, topics/public-safety.md, topics/development.md, topics/governance.md
**Pages created:** none
**Key facts added:** The City of Schertz adopted budget for FY2022-23 (October 1, 2022 – September 30, 2023) totaling $108.5 million across all funds. The budget includes a property tax rate of $0.4950 per $100 valuation, down from $0.5121 the previous year. Major components include General Fund ($44.4M), Water & Sewer Fund ($28.5M), and Interest & Sinking Fund ($8.7M). The budget adds 30 new positions citywide and includes a 3% ECI increase for employees. Key initiatives include street preservation funding, IT infrastructure upgrades, and public safety enhancements.
**Ordinances referenced:** none
**Dollar amounts found:** Total Budget - All Funds: 108549921; General Fund Revenue: 44376036; Property Tax Revenue Increase: 2541687; Water & Sewer Fund: 28485858; Total Debt Obligation: 105316557; Street Preservation and Maintenance (SPAM) increase: 250000; EMS Fund Revenue: 11720981; Economic Development Corporation Revenue: 10050960; Drainage Fund Revenue: 1450073; Interest & Sinking Fund Revenue: 8686248; Certificates of Obligation, Series 2019 - General Fund Component - Original Issue Amount: 7495000; Certificates of Obligation, Series 2019 - Utility Fund Bond Component - Original Issue Amount: 7495000; General Obligation Refunding Bonds, Series 2020 - Original Issue Amount: 7555000; General Obligation Refunding Bonds, Series 2021 - General Fund - Original Issue Amount: 6015000; General Obligation Refunding Bonds, Series 2021 - Utility Fund - Original Issue Amount: 6015000; Certificates of Obligation, Series 2022 - Original Issue Amount: 9390000; Certificates of Obligation, Series 2022A - General Fund - Original Issue Amount: 18530000; Certificates of Obligation, Series 2022A - Utility Fund - Original Issue Amount: 18530000; General Obligation Bonds, Series 2022 - Original Issue Amount: 18535000; Total Schertz Debt - All Series Combined - FY2023 Payment: 7570062; Total Schertz Debt - All Series Combined - Total Outstanding: 202829454
**Votes recorded:** 2

## [2026-06-03] INGEST | Schertz Tax Rates
**Source:** https://www.schertz.com/DocumentCenter/View/8468/Schertz-Tax-Rates
**Document type:** financial-report
**Pages updated:** topics/budget.md, topics/governance.md
**Pages created:** none
**Key facts added:** This document provides a comprehensive overview of current tax rates for the City of Schertz as of September 2025. It details sales tax rates, property tax rates across the three counties where Schertz is located (Guadalupe, Bexar, and Comal), and hotel occupancy tax rates. The city's property tax rate is consistent at $0.5118 per $100 of taxable value across all three counties, while other taxing entities vary by county.
**Ordinances referenced:** none
**Dollar amounts found:** City of Schertz property tax rate: 0.5118; City of Schertz sales tax rate: 0.01; Schertz Economic Development sales tax: 0.005; Total sales tax rate: 0.0825; Guadalupe County property tax rate: 0.2784; Schertz-Cibolo-Universal City ISD property tax rate: 1.0769; Bexar County property tax rate: 0.276331; East Central ISD property tax rate: 0.9319; Comal County property tax rate: 0.269; Comal Independent School District property tax rate: 1.0748
**Votes recorded:** 0

## [2026-06-03] INGEST | FY 2021-22 Adopted Budget
**Source:** https://www.schertz.com/DocumentCenter/View/7759/FY-2021-22-Approved-Budget
**Document type:** budget
**Pages updated:** topics/budget.md, topics/governance.md, topics/public-safety.md, topics/infrastructure.md, topics/development.md
**Pages created:** none
**Key facts added:** The City of Schertz FY 2021-22 Approved Budget was unanimously adopted by City Council. The budget totals $97.3 million in revenues across all funds, with the General Fund representing $39.3 million. The property tax rate remains unchanged at $0.5121 per $100 valuation. Major initiatives include implementing a classification and compensation study, raising minimum wage to $15/hour, replacing financial software, and funding the Animal Adoption Center HVAC replacement. The budget emphasizes maintaining service levels while managing growth.
**Ordinances referenced:** none
**Dollar amounts found:** Total revenues all funds: 97335056; General Fund revenue: 39314984; Property tax revenue increase: 761574; Financial software replacement: 500000; Animal Adoption Center HVAC replacement (City portion): 350000; Classification and Compensation Study ECI adjustment: 52750; Contract cleaning services increase: 75000; Total debt obligation secured by property taxes: 66084539; Water & Sewer Fund revenue: 28382723; EMS Fund revenue: 9785424; General Obligation Refunding Series 2018 - Total remaining principal: 4355000; General Obligation Refunding Series 2018 - Total debt service through maturity: 4685561; Certificates of Obligation Series 2018 - General Fund component remaining principal: 4180000; Certificates of Obligation Series 2018 - Water & Sewer component remaining principal: 5040000; General Obligation and Refunding Bonds Series 2018 - General Fund component: 4625000; General Obligation and Refunding Bonds Series 2018 - Utility Fund component: 2055000; Certificates of Obligation Series 2019 - General Fund component: 3510000; Certificates of Obligation Series 2019 - Utility Fund component: 3225000; General Obligation Refunding Bonds Series 2020: 7555000; General Obligation Refunding Bonds Series 2021 - General Fund component: 4070000; General Obligation Refunding Bonds Series 2021 - Utility Fund component: 1945000; Schertz/Seguin Local Government Corporation Contract Revenue Bonds - Total debt service through 2051: 253321852; FY2022 total Schertz debt payment: 4245237; FY2023 total Schertz debt payment: 5054158
**Votes recorded:** 3

## [2026-06-03] INGEST | FY 2020-21 Adopted Budget
**Source:** https://www.schertz.com/DocumentCenter/View/6733
**Document type:** budget
**Pages updated:** topics/budget.md, topics/infrastructure.md, topics/public-safety.md, topics/development.md, topics/governance.md, topics/strategic-plan.md
**Pages created:** none
**Key facts added:** This is the City of Schertz FY 2020-2021 Adopted Budget document approved by City Council. The budget includes a property tax rate of $0.5121/$100, representing a 3.9% increase in total property taxes raised compared to the prior year. The General Fund operating budget increased 7.1% from FY 2019-20 estimates, totaling $37.5 million in revenues and expenditures. Major components include personnel increases from a classification and compensation study, new positions for Police and Fire departments, and $400,000 allocated for a Comprehensive Land Use Plan update.
**Ordinances referenced:** none
**Dollar amounts found:** General Fund Total Revenue: 37474811; General Fund Total Expenditures: 37474811; Property Tax Revenue Increase: 777223; Total Debt Obligation Secured by Property Taxes: 75077338; New Personnel Positions and Programs: 386000; Employment Cost Index Adjustment: 211000; Comprehensive Land Use Plan and UDC Update: 400000; Facilities Maintenance Budget Increase: 55000; Transfer from Fund Balance for Capital Projects: 500000; Interest & Sinking Fund Revenue: 7095821; Interest & Sinking Fund Debt Service: 7044861; Water & Sewer Fund Revenue: 25504368; Water & Sewer Fund Expenditures: 24738545; Police Department Budget: 10172678; Fire Rescue Budget: 6150356; Planning & Zoning Budget: 696149; Drainage Fund Total Revenues FY2020-21: 1445564; Drainage Fund Total Expenditures FY2020-21: 1445564; EMS Total Revenues FY2020-21: 9785425; EMS Total Expenditures FY2020-21: 9732293; Economic Development Corporation Sales Tax Revenue FY2020-21: 4507371; SEDC Total Expenditures FY2020-21: 8144799; Hotel/Motel Tax Revenue FY2020-21: 520000; EMS Comal Co ESD #6 Support FY2020-21: 141411; EMS Schertz Support FY2020-21: 667049; SEDC Main Street Infrastructure Contribution: 4050000
**Votes recorded:** 1

## [2026-06-03] INGEST | Financial Summary and Charts
**Source:** https://www.schertz.com/DocumentCenter/View/162
**Document type:** financial-report
**Pages updated:** topics/budget.md, topics/financial-report.md, topics/governance.md
**Pages created:** none
**Key facts added:** This financial transparency report provides comprehensive fiscal data for the City of Schertz for Fiscal Year 2019. The report shows total revenues of $81.2 million and total expenses of $70.3 million, resulting in a positive change in net position of $10.8 million. The document includes detailed breakdowns of governmental and business-type activities, per capita metrics, and multi-year trend data from FY2012 through FY2019. Property tax rate for FY2019 was $0.5146 per $100 valuation, serving a population of 35,121 with 357 budgeted full-time equivalent positions.
**Ordinances referenced:** none
**Dollar amounts found:** Total Revenues: 81166160; Total Expenses: 70324365; Change in Net Position: 10841795; Governmental Activities Program Revenues: 7092793; Ad Valorem Tax Revenue: 19151005; Sales Tax Revenue: 12506879; Franchise Fees: 2357150; Hotel/Motel Tax Revenue: 514679; Mixed Drink Tax Revenue: 60518; Investment Earnings - Governmental: 1470258; Miscellaneous Revenue - Governmental: 984257; Total Governmental Activities Revenues: 44056014; Business-type Program Revenues: 35905617; Investment Earnings - Business-type: 855216; Miscellaneous Revenue - Business-type: 267788; Total Business-type Activities Revenues: 37110146; Governmental Activities Expenses: 38186344; Business-type Activities Expenses: 32138021
**Votes recorded:** 0

## [2026-06-03] INGEST | 2010 Unified Development CodeFinal UDC 04-13-10
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=121105&dbid=1&repo=SCHERTZ
**Document type:** agenda
**Pages updated:** topics/ordinances.md, topics/development.md, topics/governance.md
**Pages created:** none
**Key facts added:** This document is the City of Schertz 2010 Unified Development Code (UDC), finalized on April 13, 2010. The UDC serves as the comprehensive zoning and development regulations document for the city. It consolidates all land use, zoning, subdivision, and development standards into a single regulatory framework. This code replaces previous separate ordinances and establishes unified procedures for development review and approval. The UDC provides the regulatory foundation for managing growth and development within Schertz city limits.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | FINAL 2015 New Volunteer Publication1
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=281608&dbid=1&repo=SCHERTZ
**Document type:** agenda
**Pages updated:** topics/governance.md
**Pages created:** none
**Key facts added:** This document appears to be a publication regarding new volunteer opportunities or information for the City of Schertz in 2015. The document content was not provided in the extraction request, limiting the ability to provide detailed analysis. Based on the title, it likely contains information about volunteer programs, recruitment, or guidelines for citizen volunteers. This would be an informational publication rather than official council proceedings.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | City of Schertz City Charter 2024
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=527535&dbid=1&repo=SCHERTZ
**Document type:** charter
**Pages updated:** topics/governance.md, topics/ordinances.md
**Pages created:** none
**Key facts added:** This is the City of Schertz Charter for 2024, which serves as the foundational governing document establishing the structure, powers, and procedures of city government. The charter defines the form of government, council composition and duties, administrative procedures, and fundamental governance principles. As a charter document, it supersedes ordinary ordinances and can only be amended through charter amendment procedures. This document provides the legal framework within which all city operations, ordinances, and policies must operate.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | 01-15-2008 Agenda
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=62983&dbid=1&repo=SCHERTZ
**Document type:** agenda
**Pages updated:** topics/governance.md
**Pages created:** none
**Key facts added:** This is a City Council agenda for January 15, 2008. The document appears to be empty or contains no readable text content beyond the header metadata. Without substantive content, no specific agenda items, discussions, or decisions can be extracted. This may represent a placeholder document or a scanning/digitization issue with the original file.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | 01-22-2008a Agenda
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=63003&dbid=1&repo=SCHERTZ
**Document type:** agenda
**Pages updated:** topics/governance.md
**Pages created:** none
**Key facts added:** This is a City Council agenda for Schertz, TX dated January 22, 2008. The document appears to be empty or contains no readable text content beyond the metadata. No meeting items, decisions, or substantive content could be extracted from the provided document text.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | 01-29-2008-Agenda joint meeting with PZ
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=62984&dbid=1&repo=SCHERTZ
**Document type:** agenda
**Pages updated:** topics/governance.md, topics/development.md
**Pages created:** none
**Key facts added:** This is an agenda for a joint meeting between the Schertz City Council and Planning & Zoning Commission scheduled for January 29, 2008. The document appears to be a cover page or metadata record without detailed agenda items visible in the provided text. The meeting represents coordination between the legislative and planning bodies of the city. Additional details about specific agenda topics are not available in the extracted text.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | 01-8-2008a Agenda
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=63004&dbid=1&repo=SCHERTZ
**Document type:** agenda
**Pages updated:** topics/governance.md
**Pages created:** none
**Key facts added:** This is a City Council agenda for Schertz, TX dated August 6, 2008. The document appears to be incomplete or empty in the provided text, containing only separator markers with no substantive content. Without the actual agenda items, it is not possible to extract meeting topics, decisions to be made, or other relevant details. This may be a cover page or the document text was not fully captured.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | 02-05-2008 Agenda
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=63013&dbid=1&repo=SCHERTZ
**Document type:** agenda
**Pages updated:** topics/governance.md
**Pages created:** none
**Key facts added:** City Council agenda for February 5, 2008. The document appears to be empty or the text content was not successfully extracted from the source PDF. Without accessible content, specific agenda items, decisions, or discussion topics cannot be determined. This represents a data quality issue requiring manual review of the original document.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | 02-12-2008 Agenda
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=63009&dbid=1&repo=SCHERTZ
**Document type:** agenda
**Pages updated:** topics/governance.md
**Pages created:** none
**Key facts added:** This is a City Council agenda for February 12, 2008. The document appears to be empty or the text content was not successfully extracted from the source PDF. Without visible agenda items, staff reports, or meeting details, no substantive information can be extracted. This represents a data quality issue requiring follow-up to obtain the actual agenda content.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | 02-12-2008a Agenda
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=63010&dbid=1&repo=SCHERTZ
**Document type:** agenda
**Pages updated:** topics/governance.md
**Pages created:** none
**Key facts added:** This is a City Council agenda for Schertz, TX dated February 12, 2008. The document appears to be empty or contains no readable text content beyond the title and metadata. Without substantive content, no specific agenda items, decisions, financial matters, or policy discussions can be extracted.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | 02-19-2008 Agenda
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=63011&dbid=1&repo=SCHERTZ
**Document type:** agenda
**Pages updated:** topics/governance.md
**Pages created:** none
**Key facts added:** City Council agenda for February 19, 2008. The document appears to be empty or contains no readable text content. Without visible agenda items, meeting details, or substantive content, no specific decisions, budget items, or policy matters can be extracted from this document.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | 02-26-2008 Agenda
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=63012&dbid=1&repo=SCHERTZ
**Document type:** agenda
**Pages updated:** none
**Pages created:** none
**Key facts added:** This is a City Council agenda from February 26, 2008. The document appears to be empty or contains no readable text content. No meeting items, discussions, or decisions can be extracted from the provided document.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST | 03-04-2008 Agenda
**Source:** https://laserfiche.schertzweb.com/WebLink/ElectronicFile.aspx?id=62992&dbid=1&repo=SCHERTZ
**Document type:** agenda
**Pages updated:** topics/governance.md
**Pages created:** none
**Key facts added:** This is a City Council agenda for March 4, 2008. The document appears to be empty or the text extraction failed, containing no visible content beyond the metadata. Without readable content, no specific agenda items, decisions, or financial information can be extracted. This represents a data quality issue requiring document re-scanning or alternative access methods.
**Ordinances referenced:** none
**Dollar amounts found:** none
**Votes recorded:** 0

## [2026-06-03] INGEST-BATCH | Schertz seed ingestion
**Sources processed:** 20
**Succeeded:** 18 | **Failed:** 2
**Elapsed:** 584s
**Manifest:** ./raw-sources/manifest.json
**Top themes:** Initial bootstrap of Schertz, TX civic document corpus
**Data source:** https://www.schertz.com/27/Government

## [2026-06-04] QUERY | Summarize the most recent city council meeting
**Question:** Summarize the most recent city council meeting
**Wiki pages read:** topics/governance.md, topics/financial-report.md, topics/public-safety.md, topics/infrastructure.md, topics/development.md, topics/strategic-plan.md, topics/budget.md, topics/ordinances.md
**Filed:** not filed
**Gap noted:** none
