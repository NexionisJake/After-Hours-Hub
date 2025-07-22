#!/usr/bin/env python3
"""
Security Validation Script for After-Hours-Hub
This script checks for common security vulnerabilities in the codebase.
"""

import os
import re
import json
from pathlib import Path

class SecurityValidator:
    def __init__(self, project_root):
        self.project_root = Path(project_root)
        self.issues = []
        
    def check_innerHTML_usage(self):
        """Check for potentially dangerous innerHTML usage"""
        js_files = list(self.project_root.glob("**/*.js")) + list(self.project_root.glob("**/*.html"))
        
        for file_path in js_files:
            if 'node_modules' in str(file_path) or 'old html' in str(file_path):
                continue
                
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                lines = content.split('\n')
                for i, line in enumerate(lines, 1):
                    if 'innerHTML' in line and 'escapeHtml' not in line:
                        self.issues.append({
                            'type': 'XSS Risk',
                            'severity': 'HIGH',
                            'file': str(file_path),
                            'line': i,
                            'description': 'Potential XSS vulnerability with innerHTML usage',
                            'code': line.strip()
                        })
            except Exception as e:
                print(f"Warning: Could not read {file_path}: {e}")
    
    def check_hardcoded_secrets(self):
        """Check for hardcoded API keys or secrets"""
        files_to_check = list(self.project_root.glob("**/*.js")) + list(self.project_root.glob("**/*.html"))
        
        secret_patterns = [
            r'api_key\s*[=:]\s*["\'][^"\']{20,}["\']',
            r'secret\s*[=:]\s*["\'][^"\']{20,}["\']',
            r'password\s*[=:]\s*["\'][^"\']+["\']',
            r'token\s*[=:]\s*["\'][^"\']{20,}["\']'
        ]
        
        for file_path in files_to_check:
            if 'node_modules' in str(file_path):
                continue
                
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                for pattern in secret_patterns:
                    matches = re.finditer(pattern, content, re.IGNORECASE)
                    for match in matches:
                        line_num = content[:match.start()].count('\n') + 1
                        self.issues.append({
                            'type': 'Hardcoded Secret',
                            'severity': 'CRITICAL',
                            'file': str(file_path),
                            'line': line_num,
                            'description': 'Potential hardcoded secret or API key',
                            'code': match.group()
                        })
            except Exception as e:
                print(f"Warning: Could not read {file_path}: {e}")
    
    def check_csrf_protection(self):
        """Check if forms have CSRF protection"""
        html_files = list(self.project_root.glob("**/*.html"))
        
        for file_path in html_files:
            if 'old html' in str(file_path):
                continue
                
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # Look for forms without CSRF tokens
                form_matches = re.finditer(r'<form[^>]*>', content, re.IGNORECASE)
                for match in form_matches:
                    line_num = content[:match.start()].count('\n') + 1
                    form_content = content[match.start():content.find('</form>', match.end())]
                    
                    if 'csrf' not in form_content.lower() and 'token' not in form_content.lower():
                        self.issues.append({
                            'type': 'CSRF Vulnerability',
                            'severity': 'MEDIUM',
                            'file': str(file_path),
                            'line': line_num,
                            'description': 'Form without CSRF protection',
                            'code': match.group()
                        })
            except Exception as e:
                print(f"Warning: Could not read {file_path}: {e}")
    
    def check_https_enforcement(self):
        """Check for HTTP URLs that should be HTTPS"""
        files_to_check = list(self.project_root.glob("**/*.js")) + list(self.project_root.glob("**/*.html"))
        
        for file_path in files_to_check:
            if 'node_modules' in str(file_path):
                continue
                
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # Look for HTTP URLs (excluding localhost)
                http_matches = re.finditer(r'http://(?!localhost|127\.0\.0\.1)[^\s"\'<>]+', content)
                for match in http_matches:
                    line_num = content[:match.start()].count('\n') + 1
                    self.issues.append({
                        'type': 'Insecure HTTP',
                        'severity': 'MEDIUM',
                        'file': str(file_path),
                        'line': line_num,
                        'description': 'HTTP URL should use HTTPS',
                        'code': match.group()
                    })
            except Exception as e:
                print(f"Warning: Could not read {file_path}: {e}")
    
    def check_firebase_rules(self):
        """Check if Firebase rules exist and are configured"""
        firestore_rules = self.project_root / 'firestore.rules'
        firebase_json = self.project_root / 'firebase.json'
        
        if not firestore_rules.exists():
            self.issues.append({
                'type': 'Missing Security Rules',
                'severity': 'CRITICAL',
                'file': 'firestore.rules',
                'line': 0,
                'description': 'Firestore security rules file missing',
                'code': ''
            })
        
        if firebase_json.exists():
            try:
                with open(firebase_json) as f:
                    config = json.load(f)
                    if 'firestore' not in config or 'rules' not in config['firestore']:
                        self.issues.append({
                            'type': 'Firebase Configuration',
                            'severity': 'HIGH',
                            'file': 'firebase.json',
                            'line': 0,
                            'description': 'Firebase rules not configured in firebase.json',
                            'code': ''
                        })
            except Exception as e:
                self.issues.append({
                    'type': 'Firebase Configuration',
                    'severity': 'MEDIUM',
                    'file': 'firebase.json',
                    'line': 0,
                    'description': f'Error reading firebase.json: {e}',
                    'code': ''
                })
    
    def run_all_checks(self):
        """Run all security checks"""
        print("🔍 Running security validation...")
        print("=" * 50)
        
        self.check_innerHTML_usage()
        self.check_hardcoded_secrets()
        self.check_csrf_protection()
        self.check_https_enforcement()
        self.check_firebase_rules()
        
        return self.issues
    
    def generate_report(self):
        """Generate a detailed security report"""
        issues = self.run_all_checks()
        
        if not issues:
            print("✅ No security issues found!")
            return
        
        # Group issues by severity
        critical = [i for i in issues if i['severity'] == 'CRITICAL']
        high = [i for i in issues if i['severity'] == 'HIGH']
        medium = [i for i in issues if i['severity'] == 'MEDIUM']
        low = [i for i in issues if i['severity'] == 'LOW']
        
        print(f"\n📊 SECURITY REPORT")
        print("=" * 50)
        print(f"Critical Issues: {len(critical)}")
        print(f"High Priority: {len(high)}")
        print(f"Medium Priority: {len(medium)}")
        print(f"Low Priority: {len(low)}")
        print(f"Total Issues: {len(issues)}")
        
        for severity, issue_list in [("CRITICAL", critical), ("HIGH", high), ("MEDIUM", medium), ("LOW", low)]:
            if issue_list:
                print(f"\n🚨 {severity} ISSUES:")
                print("-" * 30)
                for issue in issue_list:
                    print(f"Type: {issue['type']}")
                    print(f"File: {issue['file']}:{issue['line']}")
                    print(f"Description: {issue['description']}")
                    if issue['code']:
                        print(f"Code: {issue['code']}")
                    print()

if __name__ == "__main__":
    import sys
    
    project_root = sys.argv[1] if len(sys.argv) > 1 else "."
    validator = SecurityValidator(project_root)
    validator.generate_report()
