import urllib.request
import urllib.error
import json
import re

def verify_github_link(url: str) -> bool:
    """
    Verifies if a provided link is a valid GitHub Pull Request or Commit,
    or otherwise returns HTTP 200 OK for generic links.
    """
    # Check if it's a GitHub PR: https://github.com/{owner}/{repo}/pull/{number}
    pr_match = re.match(r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)", url)
    
    if pr_match:
        owner, repo, pull_number = pr_match.groups()
        api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}"
        
        req = urllib.request.Request(api_url, headers={'User-Agent': 'Taskbit-Backend'})
        try:
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    # We can enforce that it must be open or merged here, but for now just exists
                    return True
        except urllib.error.URLError:
            return False
            
    # If not a PR, just check if the URL returns a 200 OK (basic liveness check)
    if not url.startswith('http'):
        url = 'https://' + url
        
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Taskbit-Backend'})
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status == 200
    except Exception:
        return False
