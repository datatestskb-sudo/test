import requests
import sys
import os
from datetime import datetime

class FrontendPreviewerAPITester:
    def __init__(self, base_url="https://deploy-view.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_app_id = "97011ce9-786b-4566-b871-b0f9e7ac8014"  # Existing test app
        self.uploaded_app_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, timeout=60)
                else:
                    headers['Content-Type'] = 'application/json'
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                    elif isinstance(response_data, dict):
                        if 'id' in response_data:
                            print(f"   Response ID: {response_data['id']}")
                        if 'message' in response_data:
                            print(f"   Message: {response_data['message']}")
                except:
                    print(f"   Response length: {len(response.text)} chars")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error text: {response.text[:200]}")

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_list_apps(self):
        """Test listing all apps"""
        success, response = self.run_test(
            "List Apps",
            "GET",
            "apps",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} apps")
            if len(response) > 0:
                print(f"   First app: {response[0].get('name', 'Unknown')}")
        return success, response

    def test_get_single_app(self):
        """Test getting a single app"""
        success, response = self.run_test(
            "Get Single App",
            "GET",
            f"apps/{self.test_app_id}",
            200
        )
        if success:
            print(f"   App name: {response.get('name', 'Unknown')}")
            print(f"   Framework: {response.get('framework', 'Unknown')}")
            print(f"   Files: {response.get('file_count', 0)}")
        return success

    def test_get_app_files(self):
        """Test getting app file structure"""
        success, response = self.run_test(
            "Get App Files",
            "GET",
            f"apps/{self.test_app_id}/files",
            200
        )
        if success and 'tree' in response:
            tree = response['tree']
            print(f"   Root folder: {tree.get('name', 'Unknown')}")
            print(f"   Children: {len(tree.get('children', []))}")
        return success

    def test_upload_app(self):
        """Test uploading a ZIP file"""
        zip_path = "/app/test_app.zip"
        
        if not os.path.exists(zip_path):
            print(f"❌ Test ZIP file not found at {zip_path}")
            return False
            
        try:
            with open(zip_path, 'rb') as f:
                files = {'file': ('test_app.zip', f, 'application/zip')}
                success, response = self.run_test(
                    "Upload App",
                    "POST",
                    "apps/upload",
                    200,
                    files=files
                )
                
            if success and 'id' in response:
                self.uploaded_app_id = response['id']
                print(f"   Uploaded app ID: {self.uploaded_app_id}")
                return True
        except Exception as e:
            print(f"❌ Upload failed: {str(e)}")
            
        return False

    def test_serve_app_file(self):
        """Test serving files from uploaded app"""
        if not self.uploaded_app_id:
            print("❌ No uploaded app to test file serving")
            return False
            
        # Try to serve the main entry file
        success, response = self.run_test(
            "Serve App File",
            "GET",
            f"apps/{self.uploaded_app_id}/serve/index.html",
            200
        )
        return success

    def test_get_file_content(self):
        """Test getting file content"""
        if not self.uploaded_app_id:
            print("❌ No uploaded app to test file content")
            return False
            
        success, response = self.run_test(
            "Get File Content",
            "GET",
            f"apps/{self.uploaded_app_id}/content/index.html",
            200
        )
        if success and isinstance(response, dict):
            print(f"   Content type: {response.get('type', 'Unknown')}")
            if response.get('type') == 'text':
                content_length = len(response.get('content', ''))
                print(f"   Content length: {content_length} chars")
        return success

    def test_delete_app(self):
        """Test deleting an uploaded app"""
        if not self.uploaded_app_id:
            print("❌ No uploaded app to delete")
            return False
            
        success, response = self.run_test(
            "Delete App",
            "DELETE",
            f"apps/{self.uploaded_app_id}",
            200
        )
        return success

    def test_nonexistent_app(self):
        """Test accessing non-existent app"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        success, response = self.run_test(
            "Get Non-existent App",
            "GET",
            f"apps/{fake_id}",
            404
        )
        return success

def main():
    print("🚀 Starting Frontend Previewer API Tests")
    print("=" * 50)
    
    # Setup
    tester = FrontendPreviewerAPITester()
    
    # Run tests in order
    tests = [
        ("Root Endpoint", tester.test_root_endpoint),
        ("List Apps", lambda: tester.test_list_apps()[0]),  # Only return success
        ("Get Single App", tester.test_get_single_app),
        ("Get App Files", tester.test_get_app_files),
        ("Upload App", tester.test_upload_app),
        ("Serve App File", tester.test_serve_app_file),
        ("Get File Content", tester.test_get_file_content),
        ("Delete App", tester.test_delete_app),
        ("Non-existent App", tester.test_nonexistent_app),
    ]
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if not result:
                print(f"⚠️  {test_name} failed but continuing...")
        except Exception as e:
            print(f"❌ {test_name} crashed: {str(e)}")
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success rate: {success_rate:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())