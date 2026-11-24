import unittest
import batch


class BatchTest(unittest.TestCase):
    def test_ids_and_answers_are_checked(self):
        good = {'id': 'P0001', 'use': 'yes', 'share': 'no', 'revisit': 'unsure', 'reason': '흥미가 있다', 'risk': '정확성', 'improvement': '출처 표시'}
        self.assertTrue(batch.valid_batch([good], ['P0001']))
        self.assertFalse(batch.valid_batch([good, good], ['P0001', 'P0002']))
        self.assertFalse(batch.valid_batch([{**good, 'id': 'P9999'}], ['P0001']))
        self.assertFalse(batch.valid_batch([{**good, 'use': 'maybe'}], ['P0001']))


if __name__ == '__main__':
    unittest.main()
