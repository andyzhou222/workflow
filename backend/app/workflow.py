def validate_template(defn: dict):
    if "nodes" not in defn or "edges" not in defn:
        return False, "definition must contain nodes and edges"
    nodes = defn["nodes"]
    edges = defn["edges"]
    ids = {n["id"] for n in nodes}
    for e in edges:
        if e["from"] not in ids or e["to"] not in ids:
            return False, f"edge refers to unknown node: {e}"
    starts = [n for n in nodes if n.get("type") == "start"]
    if len(starts) != 1:
        return False, "must have exactly one start node"
    return True, None
