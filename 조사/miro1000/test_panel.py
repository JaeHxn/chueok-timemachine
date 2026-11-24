import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import panel


class PanelTest(unittest.TestCase):
    def test_profiles_are_unique_and_balanced(self):
        profiles = panel.make_profiles()
        self.assertEqual(len(profiles), 1000)
        self.assertEqual(len({p['id'] for p in profiles}), 1000)
        self.assertEqual(len({json.dumps({k: v for k, v in p.items() if k != 'id'}, ensure_ascii=False, sort_keys=True) for p in profiles}), 1000)

    def test_response_validation_and_latest_valid_resume(self):
        good = {'use': 'yes', 'share': 'unsure', 'revisit': 'no', 'reason': '내용을 더 확인하고 싶습니다', 'risk': '정확성', 'improvement': '출처 표시'}
        self.assertTrue(panel.valid_answer(good))
        self.assertFalse(panel.valid_answer({**good, 'use': 'maybe'}))
        profiles = panel.make_profiles()
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'results.jsonl'
            raw = json.dumps(good)
            correct = {'id': 'P0001', 'status': 'ok', 'answer': good, 'raw': raw, 'raw_sha256': hashlib.sha256(raw.encode()).hexdigest(), 'model_requested': panel.MODEL, 'experiment': panel.experiment_hash(profiles[0])}
            path.write_text(json.dumps(correct) + '\n' + json.dumps({'id': 'P0002', 'status': 'error', 'experiment': panel.experiment_hash(profiles[1])}) + '\n', encoding='utf-8')
            self.assertEqual(panel.completed_ids(path, profiles), {'P0001'})
            path.write_text(json.dumps({**correct, 'experiment': 'wrong'}) + '\n', encoding='utf-8')
            with self.assertRaises(ValueError):
                panel.completed_ids(path, profiles)
            path.write_text(json.dumps({**correct, 'raw': '{}'}) + '\n', encoding='utf-8')
            with self.assertRaises(ValueError):
                panel.completed_ids(path, profiles)
            path.write_text(json.dumps({**correct, 'id': 'P9999'}) + '\n', encoding='utf-8')
            with self.assertRaises(ValueError):
                panel.completed_ids(path, profiles)

    def test_run_rejects_lock_and_auth_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / '.run-lock').mkdir()
            with patch.object(panel, 'HERE', root), patch('sys.argv', ['panel.py', '--run', '--limit', '1']):
                with self.assertRaises(SystemExit):
                    panel.main()
                (root / '.run-lock').rmdir()
                with patch.object(panel.shutil, 'which', return_value='codex'), patch.object(panel.subprocess, 'run', return_value=SimpleNamespace(returncode=1, stdout='', stderr='unauthenticated')):
                    with self.assertRaises(SystemExit):
                        panel.main()
                self.assertFalse((root / '.run-lock').exists())

    def test_failed_batch_stops_with_nonzero(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            auth = SimpleNamespace(returncode=0, stdout='Logged in using ChatGPT', stderr='')
            with patch.object(panel, 'HERE', root), patch('sys.argv', ['panel.py', '--run', '--limit', '4']), \
                    patch.object(panel.shutil, 'which', return_value='codex'), patch.object(panel.subprocess, 'run', return_value=auth), \
                    patch.object(panel, 'query', return_value={'id': 'fake', 'status': 'error'}):
                with self.assertRaises(SystemExit) as result:
                    panel.main()
                self.assertEqual(result.exception.code, 1)


if __name__ == '__main__':
    unittest.main()
