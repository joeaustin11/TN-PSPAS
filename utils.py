def calc_company_score(ontime, quality, feedback, projects):
    """
    Score engine: 40% ontime + 30% quality + 20% feedback + 10% projects
    """
    projects_capped = min(projects, 50) * 2
    return round((0.40 * ontime) + (0.30 * quality) + (0.20 * feedback) + (0.10 * projects_capped))

def eval_bid(bid_amt, max_bid, min_bid, company_score):
    """
    Bid evaluation: 60% inverse normalized bid value + 40% normalized performance score
    """
    range_val = max_bid - min_bid
    if range_val <= 0:
        range_val = 1
        
    bid_score = ((max_bid - bid_amt) / range_val) * 100
    return round((0.60 * bid_score) + (0.40 * company_score))
